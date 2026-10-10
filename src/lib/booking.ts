import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Reservas: franjas por día, asignación automática de mesa y anti-solapamiento.
 * El solapamiento lo garantiza la base (constraint de exclusión en ReservationTable);
 * acá se elige la mesa y, si dos reservas compiten por la misma, se prueba la siguiente.
 */

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};
/** Franjas de llegada por día: [["13:00","15:30"], ["20:00","23:00"]]. */
export type BookingHours = Partial<Record<Day, [string, string][]>>;

export type BookingConfig = {
  timezone: string;
  hours: BookingHours;
  durationMin: number;
  slotMin: number;
  graceMin: number;
  leadMin: number;
  maxDays: number;
  maxParty: number;
  notice: string | null;
};

/** Horario sugerido la primera vez que se configura (martes a domingo, mediodía y noche). */
export const DEFAULT_HOURS: BookingHours = Object.fromEntries(
  DAYS.filter((d) => d !== "mon").map((d) => [d, [["13:00", "15:30"], ["20:00", "23:00"]]]),
);

export async function getBookingConfig(tenantId: string): Promise<BookingConfig> {
  const s = await db.tenantSettings.findUnique({ where: { tenantId } });
  return {
    timezone: s?.timezone ?? "Europe/Madrid",
    hours: (s?.bookingHours as BookingHours | null) ?? {},
    durationMin: s?.bookingDurationMin ?? 90,
    slotMin: s?.bookingSlotMin ?? 30,
    graceMin: s?.bookingGraceMin ?? 15,
    leadMin: s?.bookingLeadMin ?? 60,
    maxDays: s?.bookingMaxDays ?? 30,
    maxParty: s?.bookingMaxParty ?? 8,
    notice: s?.bookingNotice ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Fechas en la zona horaria del local
// ─────────────────────────────────────────────────────────────

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Fecha/hora local del local para un instante: { date: "2026-10-10", time: "21:30", day: "sat" }. */
export function localParts(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, day: p.weekday.toLowerCase().slice(0, 3) as Day };
}

/** "2026-10-10" + "21:30" en la zona del local → instante UTC (corrige dos veces por el cambio de hora). */
export function zonedToUtc(date: string, time: string, tz: string) {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let ts = wanted;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(ts), tz);
    ts += wanted - Date.parse(`${p.date}T${p.time}:00Z`);
  }
  return new Date(ts);
}

export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayOf = (date: string): Day => DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

/** Horarios de llegada de un día según las franjas (cada `slotMin`). */
export function slotsOfDay(cfg: BookingConfig, date: string) {
  const ranges = cfg.hours[dayOf(date)] ?? [];
  const out = new Set<string>();
  for (const [from, to] of ranges) {
    for (let m = toMin(from); m <= toMin(to); m += cfg.slotMin) out.add(toHHMM(m));
  }
  return [...out].sort();
}

/** Días reservables online (desde hoy, hasta `maxDays`), solo los que tienen franjas. */
export function bookableDays(cfg: BookingConfig, now = new Date()) {
  const today = localParts(now, cfg.timezone).date;
  const days: { date: string; day: Day }[] = [];
  for (let i = 0; i <= cfg.maxDays; i++) {
    const date = addDays(today, i);
    if (slotsOfDay(cfg, date).length) days.push({ date, day: dayOf(date) });
  }
  return days;
}

// ─────────────────────────────────────────────────────────────
// Mesas libres
// ─────────────────────────────────────────────────────────────

type TableLite = { id: string; number: string; seats: number; areaId: string };
type Busy = { tableId: string; startsAt: Date; endsAt: Date };

const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/**
 * Opciones de mesa para un grupo, de mejor a peor: una mesa (la más chica que alcance)
 * y, si no hay, dos mesas del mismo salón (la suma más chica que alcance).
 */
export function tableOptions(tables: TableLite[], busy: Busy[], range: { startsAt: Date; endsAt: Date }, party: number) {
  const free = tables.filter((t) => !busy.some((b) => b.tableId === t.id && overlaps(b, range)));
  const singles = free.filter((t) => t.seats >= party).sort((a, b) => a.seats - b.seats);
  const pairs: TableLite[][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const [a, b] = [free[i], free[j]];
      if (a.areaId === b.areaId && a.seats < party && b.seats < party && a.seats + b.seats >= party) pairs.push([a, b]);
    }
  }
  pairs.sort((x, y) => x[0].seats + x[1].seats - (y[0].seats + y[1].seats));
  return [...singles.map((t) => [t]), ...pairs];
}

/** Mesas que se pueden reservar (fijas, habilitadas). */
export function bookableTables(tdb: TenantDb) {
  return tdb.table.findMany({
    where: { archivedAt: null, temporary: false, status: { not: "DISABLED" } },
    select: { id: true, number: true, seats: true, areaId: true },
    orderBy: { number: "asc" },
  });
}

/** Reservas activas que pisan un rango (para calcular disponibilidad de un día). */
function busyBetween(tenantId: string, from: Date, to: Date) {
  return db.reservationTable.findMany({
    where: { active: true, startsAt: { lt: to }, endsAt: { gt: from }, reservation: { tenantId } },
    select: { tableId: true, startsAt: true, endsAt: true },
  });
}

/**
 * Tolerancia vencida: las reservas confirmadas que no llegaron pasan a "No vino" y liberan la mesa.
 * Se ejecuta al consultar (sala, agenda, disponibilidad), sin depender de un cron.
 */
export async function expireReservations(tdb: TenantDb, graceMin: number) {
  const limit = new Date(Date.now() - graceMin * 60_000);
  const expired = await tdb.reservation.findMany({ where: { status: "CONFIRMED", startsAt: { lt: limit } }, select: { id: true } });
  if (!expired.length) return;
  const ids = expired.map((r) => r.id);
  await tdb.reservation.updateMany({ where: { id: { in: ids } }, data: { status: "NO_SHOW" } });
  await db.reservationTable.updateMany({ where: { reservationId: { in: ids } }, data: { active: false } });
}

/** Horarios de un día con disponibilidad para `party` personas. */
export async function availability(tdb: TenantDb, tenantId: string, cfg: BookingConfig, date: string, party: number, now = new Date()) {
  await expireReservations(tdb, cfg.graceMin);
  const slots = slotsOfDay(cfg, date);
  if (!slots.length) return [];
  const minStart = new Date(now.getTime() + cfg.leadMin * 60_000);
  const ranges = slots.map((time) => {
    const startsAt = zonedToUtc(date, time, cfg.timezone);
    return { time, startsAt, endsAt: new Date(startsAt.getTime() + cfg.durationMin * 60_000) };
  });
  const [tables, busy] = await Promise.all([
    bookableTables(tdb),
    busyBetween(tenantId, ranges[0].startsAt, ranges[ranges.length - 1].endsAt),
  ]);
  return ranges.map((r) => ({
    time: r.time,
    available: r.startsAt >= minStart && tableOptions(tables, busy, r, party).length > 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// Crear
// ─────────────────────────────────────────────────────────────

export type NewBooking = {
  date: string;
  time: string;
  party: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  source: "PUBLIC" | "STAFF";
  /** Solo el local: mesas elegidas a mano (evento multi-mesa). Vacío = automático. */
  tableIds?: string[];
  consent?: boolean;
};

const isOverlapError = (e: unknown) => {
  const msg = String((e as { message?: string })?.message ?? "") + JSON.stringify((e as { meta?: unknown })?.meta ?? {});
  return msg.includes("ReservationTable_no_overlap") || msg.includes("23P01");
};

/** Crea la reserva confirmada con mesa asignada. Si otra reserva ganó la mesa en el medio, prueba la siguiente opción. */
export async function createBooking(tdb: TenantDb, tenantId: string, cfg: BookingConfig, b: NewBooking) {
  const startsAt = zonedToUtc(b.date, b.time, cfg.timezone);
  const endsAt = new Date(startsAt.getTime() + cfg.durationMin * 60_000);
  const range = { startsAt, endsAt };
  const tables = await bookableTables(tdb);

  let options: TableLite[][];
  if (b.tableIds?.length) {
    const picked = tables.filter((t) => b.tableIds!.includes(t.id));
    if (picked.length !== b.tableIds.length) return { error: "Hay una mesa que no se puede reservar" } as const;
    options = [picked];
  } else {
    await expireReservations(tdb, cfg.graceMin);
    options = tableOptions(tables, await busyBetween(tenantId, startsAt, endsAt), range, b.party);
  }
  if (!options.length) return { error: "Ya no queda lugar a esa hora. Probá con otro horario." } as const;

  for (const option of options.slice(0, 6)) {
    try {
      const data: Prisma.ReservationUncheckedCreateInput = {
        tenantId,
        code: randomBytes(9).toString("base64url"),
        source: b.source,
        customerName: b.name,
        customerPhone: b.phone,
        customerEmail: b.email,
        partySize: b.party,
        notes: b.notes,
        startsAt,
        endsAt,
        consentAt: b.consent ? new Date() : null,
        tables: { create: option.map((t) => ({ tableId: t.id, startsAt, endsAt })) },
      };
      const created = await tdb.reservation.create({ data });
      return { reservation: created, tables: option } as const;
    } catch (e) {
      if (!isOverlapError(e)) throw e;
      if (b.tableIds?.length) return { error: "Esa mesa ya tiene una reserva que se pisa con ese horario" } as const;
    }
  }
  return { error: "Ya no queda lugar a esa hora. Probá con otro horario." } as const;
}

/** Cancelar / no vino / completada: la reserva deja de ocupar la mesa. */
export async function releaseReservation(tdb: TenantDb, id: string, status: "CANCELLED" | "NO_SHOW" | "COMPLETED") {
  await tdb.reservation.update({
    where: { id },
    data: { status, ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}) },
  });
  await db.reservationTable.updateMany({ where: { reservationId: id }, data: { active: false } });
}

/** Texto de fecha para personas: "sábado 10 de octubre · 21:30". */
export function formatBooking(d: Date, tz: string) {
  const date = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return `${date} · ${time}`;
}
