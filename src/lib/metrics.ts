import "server-only";
import { isValidDate, localParts, zonedToUtc } from "@/lib/booking";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Métricas del local sobre las mesas cobradas en un rango de fechas (zona del local).
 * Se calculan al consultar: con el volumen de un restaurante (cientos de mesas por mes)
 * no hacen falta agregados diarios precalculados.
 */

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const PRESETS = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "mes", label: "Este mes" },
  { id: "mes-anterior", label: "Mes anterior" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

/** Rango [desde, hasta] inclusive en fechas locales, a partir de un preset o de fechas sueltas. */
export function metricsRange(params: { preset?: string; desde?: string; hasta?: string }, tz: string) {
  const today = localParts(new Date(), tz).date;
  let from: string;
  let to: string;
  let preset: PresetId | null = null;
  if (params.desde && params.hasta && isValidDate(params.desde) && isValidDate(params.hasta)) {
    [from, to] = params.desde <= params.hasta ? [params.desde, params.hasta] : [params.hasta, params.desde];
    if (to > today) to = today;
  } else {
    preset = (PRESETS.some((p) => p.id === params.preset) ? params.preset : "30d") as PresetId;
    to = today;
    if (preset === "hoy") from = today;
    else if (preset === "7d") from = addDays(today, -6);
    else if (preset === "30d") from = addDays(today, -29);
    else if (preset === "mes") from = `${today.slice(0, 8)}01`;
    else {
      const firstThis = `${today.slice(0, 8)}01`;
      to = addDays(firstThis, -1);
      from = `${to.slice(0, 8)}01`;
    }
  }
  return { from, to, preset, start: zonedToUtc(from, "00:00", tz), end: zonedToUtc(addDays(to, 1), "00:00", tz) };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

export async function getMetrics(tdb: TenantDb, start: Date, end: Date, tz: string) {
  const [sessions, products] = await Promise.all([
    tdb.tableSession.findMany({
      where: { status: "CLOSED", closedAt: { gte: start, lt: end }, totalCents: { gt: 0 } },
      include: {
        table: { select: { number: true } },
        waiter: { include: { user: { select: { name: true } } } },
        payments: { select: { tipCents: true } },
        orders: {
          where: { status: { not: "REJECTED" } },
          include: { items: { where: { status: { not: "CANCELLED" } } } },
        },
      },
    }),
    tdb.product.findMany({ select: { id: true, category: { select: { name: true } } } }),
  ]);
  const categoryOf = new Map(products.map((p) => [p.id, p.category.name]));

  // ── Resumen
  const revenue = sessions.reduce((n, s) => n + (s.totalCents ?? 0), 0);
  const guests = sessions.reduce((n, s) => n + s.guests, 0);
  const tips = sessions.reduce((n, s) => n + s.payments.reduce((m, p) => m + p.tipCents, 0), 0);
  const stays = sessions.map((s) => minutes(s.openedAt, s.closedAt!));

  // Días con servicio y su ventana (primera apertura → último cierre): base de la rotación y la ocupación.
  const windows = new Map<string, { open: number; close: number }>();
  for (const s of sessions) {
    const day = localParts(s.openedAt, tz).date;
    const w = windows.get(day);
    const o = s.openedAt.getTime();
    const c = s.closedAt!.getTime();
    windows.set(day, w ? { open: Math.min(w.open, o), close: Math.max(w.close, c) } : { open: o, close: c });
  }
  const serviceDays = windows.size;
  const serviceMinutes = [...windows.values()].reduce((n, w) => n + (w.close - w.open) / 60_000, 0);

  // ── Por mesa
  const tableMap = new Map<string, { label: string; sessions: number; guests: number; revenue: number; stay: number }>();
  for (const s of sessions) {
    const label = s.tableLabel ?? s.table.number;
    const t = tableMap.get(label) ?? { label, sessions: 0, guests: 0, revenue: 0, stay: 0 };
    t.sessions++;
    t.guests += s.guests;
    t.revenue += s.totalCents ?? 0;
    t.stay += minutes(s.openedAt, s.closedAt!);
    tableMap.set(label, t);
  }
  const byTable = [...tableMap.values()]
    .map((t) => ({
      label: t.label,
      sessions: t.sessions,
      guests: t.guests,
      revenue: t.revenue,
      avgStay: t.stay / t.sessions,
      perDay: serviceDays ? t.sessions / serviceDays : 0,
      // Qué parte del horario de servicio estuvo ocupada.
      occupancy: serviceMinutes ? t.stay / serviceMinutes : 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));

  // ── Por producto
  const productMap = new Map<string, { name: string; category: string; quantity: number; revenue: number; comped: number }>();
  for (const s of sessions)
    for (const o of s.orders)
      for (const i of o.items) {
        const key = i.productId ?? `n:${i.name}`;
        const p = productMap.get(key) ?? { name: i.name, category: (i.productId && categoryOf.get(i.productId)) || "Sin categoría", quantity: 0, revenue: 0, comped: 0 };
        p.quantity += i.quantity;
        if (i.comped) p.comped += i.quantity;
        else p.revenue += i.unitPriceCents * i.quantity;
        productMap.set(key, p);
      }
  const byProduct = [...productMap.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
  const categories = [...new Set(byProduct.map((p) => p.category))]
    .map((c) => ({ category: c, revenue: byProduct.filter((p) => p.category === c).reduce((n, p) => n + p.revenue, 0) }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Por mozo
  const waiterMap = new Map<string, { name: string; sessions: number; guests: number; revenue: number; tips: number; stay: number }>();
  for (const s of sessions) {
    const key = s.waiterId ?? "-";
    const w = waiterMap.get(key) ?? { name: s.waiter?.user.name ?? "Sin mozo asignado", sessions: 0, guests: 0, revenue: 0, tips: 0, stay: 0 };
    w.sessions++;
    w.guests += s.guests;
    w.revenue += s.totalCents ?? 0;
    w.tips += s.payments.reduce((n, p) => n + p.tipCents, 0);
    w.stay += minutes(s.openedAt, s.closedAt!);
    waiterMap.set(key, w);
  }
  const byWaiter = [...waiterMap.values()]
    .map((w) => ({ ...w, avgTicket: w.revenue / w.sessions, avgStay: w.stay / w.sessions }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Por franja horaria (hora de llegada) y por día de la semana
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0, revenue: 0 }));
  const WEEK = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const byWeekday = WEEK.map((label) => ({ label, sessions: 0, revenue: 0, days: new Set<string>() }));
  for (const s of sessions) {
    const p = localParts(s.openedAt, tz);
    const h = byHour[Number(p.time.slice(0, 2))];
    h.sessions++;
    h.revenue += s.totalCents ?? 0;
    const wd = byWeekday[(new Date(`${p.date}T12:00:00Z`).getUTCDay() + 6) % 7];
    wd.sessions++;
    wd.revenue += s.totalCents ?? 0;
    wd.days.add(p.date);
  }

  // ── Tiempos de cocina y barra: aceptado → listo, y listo → entregado.
  const prep: Record<"KITCHEN" | "BAR", number[]> = { KITCHEN: [], BAR: [] };
  const waitToDeliver: number[] = [];
  const prepByProduct = new Map<string, { name: string; station: string; times: number[] }>();
  for (const s of sessions)
    for (const o of s.orders)
      for (const i of o.items) {
        if (i.readyAt && o.acceptedAt && (i.station === "KITCHEN" || i.station === "BAR")) {
          const m = minutes(o.acceptedAt, i.readyAt);
          if (m >= 0 && m < 240) {
            prep[i.station].push(m);
            const k = i.productId ?? i.name;
            const e = prepByProduct.get(k) ?? { name: i.name, station: i.station, times: [] };
            e.times.push(m);
            prepByProduct.set(k, e);
          }
        }
        if (i.readyAt && i.deliveredAt) {
          const m = minutes(i.readyAt, i.deliveredAt);
          if (m >= 0 && m < 120) waitToDeliver.push(m);
        }
      }
  const slowest = [...prepByProduct.values()]
    .filter((p) => p.times.length >= 3)
    .map((p) => ({ name: p.name, station: p.station, avg: avg(p.times)!, count: p.times.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  return {
    summary: {
      revenue,
      sessions: sessions.length,
      guests,
      tips,
      avgTicket: sessions.length ? revenue / sessions.length : 0,
      perGuest: guests ? revenue / guests : 0,
      avgStay: avg(stays),
      serviceDays,
      tablesPerDay: serviceDays ? sessions.length / serviceDays : 0,
    },
    byTable,
    byProduct,
    categories,
    byWaiter,
    byHour,
    byWeekday: byWeekday.map(({ days, ...w }) => ({ ...w, avgPerDay: days.size ? w.revenue / days.size : 0 })),
    kitchen: {
      kitchenAvg: avg(prep.KITCHEN),
      kitchenCount: prep.KITCHEN.length,
      barAvg: avg(prep.BAR),
      barCount: prep.BAR.length,
      deliverAvg: avg(waitToDeliver),
      slowest,
    },
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;
