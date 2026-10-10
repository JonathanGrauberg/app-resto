"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  availability,
  bookableDays,
  createBooking,
  getBookingConfig,
  isValidDate,
  releaseReservation,
  slotsOfDay,
} from "@/lib/booking";
import { mailBooking } from "@/lib/booking-mail";
import { db } from "@/lib/db";
import { hasModule } from "@/lib/modules";
import { notifyStaff } from "@/lib/realtime/server";
import { tenantDb } from "@/lib/tenant-db";

/** Local con reservas online activas (módulo + horarios cargados). */
async function bookingContext(slug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { settings: true } });
  if (!tenant || !tenant.active || !(await hasModule(tenant.id, "RESERVAS"))) return null;
  const cfg = await getBookingConfig(tenant.id);
  return { tenant, cfg, tdb: tenantDb(tenant.id) };
}

/** Horarios de un día para N personas (se consulta al elegir fecha o cambiar la cantidad). */
export async function getSlots(slug: string, date: string, party: number) {
  const ctx = await bookingContext(slug);
  if (!ctx || !isValidDate(date)) return [];
  const n = Math.round(party);
  if (!(n >= 1 && n <= ctx.cfg.maxParty)) return [];
  if (!bookableDays(ctx.cfg).some((d) => d.date === date)) return [];
  return availability(ctx.tdb, ctx.tenant.id, ctx.cfg, date, n);
}

const bookingSchema = z.object({
  date: z.string().refine(isValidDate, "Elegí una fecha"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Elegí un horario"),
  party: z.number().int().min(1),
  name: z.string().trim().min(2, "Poné tu nombre").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => /^[+\d][\d\s-]{6,}$/.test(v), "Teléfono no válido"),
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
  consent: z.literal(true, "Tenés que aceptar la política de privacidad"),
  /** Trampa para bots: campo oculto que una persona deja vacío. */
  website: z.string().max(0).optional(),
});

export type BookingInput = z.input<typeof bookingSchema>;
type Result = { code: string } | { error: string; fieldErrors?: Record<string, string> };

export async function book(slug: string, input: BookingInput): Promise<Result> {
  const ctx = await bookingContext(slug);
  if (!ctx) return { error: "Este local no toma reservas online" };
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Revisá los datos marcados", fieldErrors };
  }
  const d = parsed.data;
  const { cfg, tdb, tenant } = ctx;
  if (d.party > cfg.maxParty) return { error: `Para más de ${cfg.maxParty} personas, reservá por teléfono` };

  // El horario tiene que existir y seguir libre (la disponibilidad pudo cambiar mientras completaba).
  if (!bookableDays(cfg).some((x) => x.date === d.date) || !slotsOfDay(cfg, d.date).includes(d.time)) {
    return { error: "Ese horario no está disponible" };
  }
  const slots = await availability(tdb, tenant.id, cfg, d.date, d.party);
  if (!slots.find((s) => s.time === d.time)?.available) return { error: "Ese horario se acaba de ocupar. Elegí otro." };

  const res = await createBooking(tdb, tenant.id, cfg, {
    date: d.date,
    time: d.time,
    party: d.party,
    name: d.name,
    phone: d.phone,
    email: d.email,
    notes: d.notes,
    source: "PUBLIC",
    consent: true,
  });
  if ("error" in res) return { error: res.error ?? "No se pudo reservar" };
  const r = res.reservation;

  await mailBooking("confirmed", r, {
    name: tenant.name,
    slug: tenant.slug,
    address: tenant.settings?.address,
    phone: tenant.settings?.phone,
    timezone: cfg.timezone,
  });
  await notifyStaff(tenant.id, {
    type: "booking.new",
    name: r.customerName,
    party: r.partySize,
    startsAt: r.startsAt.toISOString(),
    tables: res.tables.map((t) => t.number).join("+"),
  });
  revalidatePath("/admin/reservas");
  revalidatePath("/staff", "layout");
  return { code: r.code };
}

/** El cliente cancela desde el enlace de su reserva. */
export async function cancelBooking(slug: string, code: string): Promise<{ ok?: string; error?: string }> {
  const ctx = await bookingContext(slug);
  if (!ctx) return { error: "Reserva no encontrada" };
  const r = await ctx.tdb.reservation.findUnique({ where: { code } });
  if (!r) return { error: "Reserva no encontrada" };
  if (r.status !== "CONFIRMED") return { error: "Esta reserva ya no se puede cancelar" };
  await releaseReservation(ctx.tdb, r.id, "CANCELLED");
  await mailBooking("cancelled", r, {
    name: ctx.tenant.name,
    slug: ctx.tenant.slug,
    phone: ctx.tenant.settings?.phone,
    timezone: ctx.cfg.timezone,
  });
  await notifyStaff(ctx.tenant.id, { type: "booking.cancelled", name: r.customerName, startsAt: r.startsAt.toISOString() });
  revalidatePath(`/${slug}/reserva/${code}`);
  revalidatePath("/admin/reservas");
  revalidatePath("/staff", "layout");
  return { ok: "Reserva cancelada" };
}
