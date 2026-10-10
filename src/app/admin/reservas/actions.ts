"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { DAYS, createBooking, getBookingConfig, isValidDate, isValidTime, releaseReservation, type BookingHours } from "@/lib/booking";
import { mailBooking } from "@/lib/booking-mail";
import { db } from "@/lib/db";
import { notifyStaff } from "@/lib/realtime/server";
import { joinTables, openTable } from "@/app/staff/sala-actions";

function refresh() {
  revalidatePath("/admin/reservas");
  revalidatePath("/admin", "layout");
  revalidatePath("/staff", "layout");
}

// ─────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────

/** "13:00-15:30, 20:00-23:00" → [["13:00","15:30"],["20:00","23:00"]]. Vacío = cerrado. */
function parseRanges(text: string): [string, string][] | string {
  const parts = text
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: [string, string][] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})[:.]?(\d{2})?\s*(?:-|a|–)\s*(\d{1,2})[:.]?(\d{2})?$/);
    if (!m) return `No entiendo "${p}". Usá el formato 13:00-15:30`;
    const from = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
    const to = `${m[3].padStart(2, "0")}:${m[4] ?? "00"}`;
    if (!isValidTime(from) || !isValidTime(to)) return `Hora no válida en "${p}"`;
    if (to < from) return `En "${p}" la última llegada es antes que la primera`;
    out.push([from, to]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

const settingsSchema = z.object({
  bookingDurationMin: z.coerce.number().int().min(30, "Mínimo 30 min").max(480, "Máximo 8 h"),
  bookingSlotMin: z.coerce.number().int().refine((v) => [15, 30, 60].includes(v), "15, 30 o 60"),
  bookingGraceMin: z.coerce.number().int().min(0).max(120, "Máximo 120 min"),
  bookingLeadMin: z.coerce.number().int().min(0).max(2880, "Máximo 48 h"),
  bookingMaxDays: z.coerce.number().int().min(1, "Mínimo 1").max(180, "Máximo 180"),
  bookingMaxParty: z.coerce.number().int().min(1, "Mínimo 1").max(50, "Máximo 50"),
  bookingNotice: z
    .string()
    .trim()
    .max(300, "Máximo 300 caracteres")
    .transform((v) => v || null),
});

export async function saveBookingSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES, "RESERVAS");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);

  const hours: BookingHours = {};
  const fieldErrors: Record<string, string> = {};
  for (const d of DAYS) {
    const r = parseRanges(String(formData.get(`hours_${d}`) ?? ""));
    if (typeof r === "string") fieldErrors[`hours_${d}`] = r;
    else if (r.length) hours[d] = r;
  }
  if (Object.keys(fieldErrors).length) return { error: "Revisá los horarios marcados", fieldErrors };

  await db.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, ...parsed.data, bookingHours: hours },
    update: { ...parsed.data, bookingHours: hours },
  });
  refresh();
  revalidatePath(`/${tenant.slug}`, "layout");
  return success("Configuración guardada");
}

// ─────────────────────────────────────────────────────────────
// Reservas cargadas por el local (teléfono, eventos multi-mesa)
// ─────────────────────────────────────────────────────────────

const staffBookingSchema = z.object({
  date: z.string().refine(isValidDate, "Fecha no válida"),
  time: z.string().refine(isValidTime, "Hora no válida"),
  party: z.coerce.number().int().min(1, "Mínimo 1").max(200),
  name: z.string().trim().min(2, "Poné un nombre").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.email().safeParse(v).success, "Email no válido"),
  notes: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
  tableIds: z.array(z.string()).max(30),
});

export async function createStaffBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "RESERVAS");
  const parsed = staffBookingSchema.safeParse({ ...Object.fromEntries(formData), tableIds: formData.getAll("tableIds") });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const cfg = await getBookingConfig(tenant.id);

  if (d.tableIds.length) {
    const seats = (await tdb.table.findMany({ where: { id: { in: d.tableIds } }, select: { seats: true } })).reduce((n, t) => n + t.seats, 0);
    if (seats < d.party) return { error: `Las mesas elegidas suman ${seats} sillas para ${d.party} personas. Sumá otra mesa.` };
  }
  const res = await createBooking(tdb, tenant.id, cfg, { ...d, source: "STAFF" });
  if ("error" in res) return { error: res.error };

  await mailBooking("confirmed", res.reservation, {
    name: tenant.name,
    slug: tenant.slug,
    timezone: cfg.timezone,
  });
  refresh();
  return success(`Reserva de ${d.name} confirmada · Mesa ${res.tables.map((t) => t.number).join("+")}`);
}

// ─────────────────────────────────────────────────────────────
// Estado: sentar, no vino, cancelar
// ─────────────────────────────────────────────────────────────

/** Llegaron: se abre la mesa (juntando las de la reserva si son varias) con los comensales de la reserva. */
export async function seatReservation(id: string): Promise<ActionState> {
  const { tdb } = await requireTenantRole(CAN_MANAGE_TABLES, "RESERVAS");
  const r = await tdb.reservation.findUnique({ where: { id }, include: { tables: { include: { table: true } } } });
  if (!r) return { error: "Reserva no encontrada" };
  if (r.status !== "CONFIRMED") return { error: "La reserva ya no está pendiente" };
  const tables = r.tables.map((t) => t.table).sort((a, b) => a.number.localeCompare(b.number, "es", { numeric: true }));
  if (!tables.length) return { error: "La reserva no tiene mesa" };
  const busy = tables.filter((t) => t.status !== "FREE");
  if (busy.length) return { error: `La mesa ${busy.map((t) => t.number).join(", ")} no está libre. Liberala o cambiá la mesa.` };

  if (tables.length > 1) {
    const joined = await joinTables(tables.map((t) => t.id));
    if (joined?.error) return joined;
  }
  const opened = await openTable(tables[0].id, r.partySize);
  if (opened?.error) return opened;
  await tdb.reservation.update({ where: { id }, data: { status: "SEATED", seatedAt: new Date() } });
  refresh();
  return success(`Mesa ${tables.map((t) => t.number).join("+")} abierta para ${r.customerName}`);
}

export async function setReservationStatus(id: string, status: "CANCELLED" | "NO_SHOW"): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(CAN_MANAGE_TABLES, "RESERVAS");
  const r = await tdb.reservation.findUnique({ where: { id } });
  if (!r) return { error: "Reserva no encontrada" };
  if (r.status !== "CONFIRMED") return { error: "La reserva ya no está pendiente" };
  await releaseReservation(tdb, id, status);
  if (status === "CANCELLED") {
    const cfg = await getBookingConfig(tenant.id);
    await mailBooking("cancelled", r, { name: tenant.name, slug: tenant.slug, timezone: cfg.timezone }, true);
  }
  await notifyStaff(tenant.id, { type: "table" });
  refresh();
  return success(status === "CANCELLED" ? "Reserva cancelada" : "Marcada como no presentada");
}
