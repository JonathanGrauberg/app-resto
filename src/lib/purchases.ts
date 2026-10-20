import "server-only";
import { isValidDate, localParts, zonedToUtc } from "@/lib/booking";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Compras vs ventas por semana (lunes a domingo) o por mes, en la hora del local.
 * Vendido = lo cobrado en caja en el período (sin propinas: la propina no es venta).
 */

export type PeriodKind = "semana" | "mes";

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0

/** Período que contiene `ref` (YYYY-MM-DD, hoy si no viene). */
export function periodOf(kind: PeriodKind, ref: string | undefined, tz: string, locale: string) {
  const today = localParts(new Date(), tz).date;
  const day = ref && isValidDate(ref) ? ref : today;
  let start: string;
  let end: string; // exclusivo
  let prev: string;
  let next: string;
  let label: string;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { ...o, timeZone: "UTC" });

  if (kind === "semana") {
    start = addDays(day, -weekday(day));
    end = addDays(start, 7);
    prev = addDays(start, -7);
    next = end;
    const last = addDays(start, 6);
    const sameMonth = start.slice(5, 7) === last.slice(5, 7);
    label = `Semana del ${fmt(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} al ${fmt(last, { day: "numeric", month: "long" })}`;
  } else {
    start = `${day.slice(0, 8)}01`;
    const [y, m] = start.split("-").map(Number);
    end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    next = end;
    label = fmt(start, { month: "long", year: "numeric" });
  }
  return {
    kind,
    start,
    end,
    prev,
    next,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    from: zonedToUtc(start, "00:00", tz),
    to: zonedToUtc(end, "00:00", tz),
    isCurrent: today >= start && today < end,
    today,
  };
}

/** Vendido, comprado y resultado del período, con el detalle de compras. */
export async function purchaseSummary(tdb: TenantDb, from: Date, to: Date) {
  const [payments, purchases] = await Promise.all([
    tdb.payment.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { amountCents: true, tipCents: true, sessionId: true },
    }),
    tdb.purchase.findMany({ where: { date: { gte: from, lt: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ]);
  const soldCents = payments.reduce((n, p) => n + p.amountCents, 0);
  const purchasedCents = purchases.reduce((n, p) => n + p.amountCents, 0);
  const byCategory = (["FOOD", "DRINKS", "SUPPLIES", "OTHER"] as const).map((c) => ({
    category: c,
    amountCents: purchases.filter((p) => p.category === c).reduce((n, p) => n + p.amountCents, 0),
  }));
  return {
    soldCents,
    tipsCents: payments.reduce((n, p) => n + p.tipCents, 0),
    tables: new Set(payments.map((p) => p.sessionId)).size,
    purchasedCents,
    resultCents: soldCents - purchasedCents,
    byCategory,
    purchases,
  };
}

/** Día de compra (YYYY-MM-DD en la zona del local) → instante guardado: mediodía local, no se corre de día. */
export const purchaseDate = (date: string, tz: string) => zonedToUtc(date, "12:00", tz);
