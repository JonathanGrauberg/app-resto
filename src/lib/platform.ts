import "server-only";
import { billingState } from "@/lib/subscription";
import { localParts } from "@/lib/booking";
import { db } from "@/lib/db";
import { planOf } from "@/lib/plans";
import { regionOf } from "@/lib/region";

/**
 * Datos del panel de plataforma (el equipo dueño de la app): todos los locales.
 * Usa el cliente sin filtro de tenant a propósito; solo se llama detrás de requirePlatformAdmin.
 */

const DAY = 86_400_000;

/** Uso de cada local: mesas cobradas y facturación (30 días) y última actividad. */
export async function tenantsOverview() {
  const since = new Date(Date.now() - 30 * DAY);
  const [tenants, sales, lastTable, lastLogin] = await Promise.all([
    db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        settings: { select: { country: true, currency: true, locale: true, timezone: true, address: true } },
        modules: true,
        memberships: { where: { role: "OWNER" }, include: { user: { select: { name: true, email: true } } } },
        _count: { select: { tables: { where: { archivedAt: null } }, products: true, memberships: { where: { active: true } } } },
        subscription: true,
      },
    }),
    db.tableSession.groupBy({
      by: ["tenantId"],
      where: { status: "CLOSED", closedAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    db.tableSession.groupBy({ by: ["tenantId"], _max: { openedAt: true } }),
    db.authSession.groupBy({ by: ["tenantId"], where: { tenantId: { not: null } }, _max: { createdAt: true } }),
  ]);

  return tenants.map((t) => {
    const s = sales.find((x) => x.tenantId === t.id);
    const lastUse = [lastTable.find((x) => x.tenantId === t.id)?._max.openedAt, lastLogin.find((x) => x.tenantId === t.id)?._max.createdAt]
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const now = Date.now();
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      active: t.active,
      createdAt: t.createdAt,
      region: regionOf(t.settings),
      billing: billingState(t.subscription, now),
      /** Precio mensual de la suscripción (centavos de su moneda; 0 = sin cargo o sin configurar). */
      priceCents: t.subscription && !t.subscription.cancelledAt ? t.subscription.priceCents : 0,
      address: t.settings?.address ?? null,
      modules: t.modules.filter((m) => m.enabled && (!m.expiresAt || m.expiresAt.getTime() > now)).map((m) => m.module),
      expiring: t.modules.filter((m) => m.enabled && m.expiresAt && m.expiresAt.getTime() > now && m.expiresAt.getTime() < now + 14 * DAY),
      owners: t.memberships.map((m) => ({ name: m.user.name, email: m.user.email })),
      tables: t._count.tables,
      products: t._count.products,
      staff: t._count.memberships,
      sessions30: s?._count._all ?? 0,
      revenue30: s?._sum.totalCents ?? 0,
      lastUse: lastUse ?? null,
      /** Días desde el último uso (null = nunca se usó). */
      lastUseDays: lastUse ? Math.floor((now - lastUse.getTime()) / DAY) : null,
      /** Activo pero sin uso hace 7 días o más. */
      idle: !lastUse || now - lastUse.getTime() > 7 * DAY,
      createdThisMonth: t.createdAt >= new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1),
      /** Alta en los últimos 7 días. */
      fresh: now - t.createdAt.getTime() < 7 * DAY,
    };
  });
}

/** Cuántos locales activos hay en cada plan ("medida" = combinación propia). */
export async function plansUsage() {
  const now = Date.now();
  const tenants = await db.tenant.findMany({ where: { active: true }, include: { modules: true } });
  const count = new Map<string, number>();
  for (const t of tenants) {
    const keys = t.modules.filter((m) => m.enabled && (!m.expiresAt || m.expiresAt.getTime() > now)).map((m) => m.module);
    const id = planOf(keys)?.id ?? "medida";
    count.set(id, (count.get(id) ?? 0) + 1);
  }
  return count;
}

export type TenantRow = Awaited<ReturnType<typeof tenantsOverview>>[number];

/** Mesas cobradas por día en todos los locales (últimos 30 días, en la fecha local de cada local). */
export async function sessionsPerDay(tenants: TenantRow[]) {
  const since = new Date(Date.now() - 30 * DAY);
  const rows = await db.tableSession.findMany({
    where: { status: "CLOSED", closedAt: { gte: since } },
    select: { tenantId: true, closedAt: true },
  });
  const tz = new Map(tenants.map((t) => [t.id, t.region.timezone]));
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const d = localParts(r.closedAt!, tz.get(r.tenantId) ?? "UTC").date;
    if (counts.has(d)) counts.set(d, counts.get(d)! + 1);
  }
  return days.map((d) => ({ date: d, sessions: counts.get(d)! }));
}

/** Próximas reservas confirmadas (7 días), en todos los locales. */
export function upcomingBookings() {
  return db.reservation.count({ where: { status: "CONFIRMED", startsAt: { gte: new Date(), lt: new Date(Date.now() + 7 * DAY) } } });
}

/** Ficha de un local para la plataforma. */
export async function tenantDetail(id: string) {
  const since = new Date(Date.now() - 30 * DAY);
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      settings: true,
      modules: { orderBy: { module: "asc" } },
      memberships: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      areas: { select: { id: true } },
      subscription: true,
      billingPayments: { orderBy: { periodTo: "desc" }, take: 24 },
    },
  });
  if (!tenant) return null;
  const [sales, guests, bookings, purchases, tables, products, lastSession] = await Promise.all([
    db.tableSession.aggregate({ where: { tenantId: id, status: "CLOSED", closedAt: { gte: since } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.tableSession.aggregate({ where: { tenantId: id, status: "CLOSED", closedAt: { gte: since } }, _sum: { guests: true } }),
    db.reservation.count({ where: { tenantId: id, createdAt: { gte: since } } }),
    db.purchase.aggregate({ where: { tenantId: id, date: { gte: since } }, _count: { _all: true }, _sum: { amountCents: true } }),
    db.table.count({ where: { tenantId: id, archivedAt: null, temporary: false } }),
    db.product.count({ where: { tenantId: id } }),
    db.tableSession.findFirst({ where: { tenantId: id }, orderBy: { openedAt: "desc" }, select: { openedAt: true } }),
  ]);
  const now = Date.now();
  return {
    tenant,
    region: regionOf(tenant.settings),
    billing: billingState(tenant.subscription, now),
    /** Módulos vigentes (activos y sin vencer) y los vencidos. */
    activeModules: tenant.modules.filter((m) => m.enabled && (!m.expiresAt || m.expiresAt.getTime() > now)).map((m) => m.module),
    expiredModules: tenant.modules.filter((m) => m.expiresAt && m.expiresAt.getTime() <= now).map((m) => m.module),
    usage: {
      sessions: sales._count._all,
      revenue: sales._sum.totalCents ?? 0,
      guests: guests._sum.guests ?? 0,
      bookings,
      purchases: purchases._count._all,
      purchasedCents: purchases._sum.amountCents ?? 0,
      tables,
      products,
      areas: tenant.areas.length,
      lastSession: lastSession?.openedAt ?? null,
    },
  };
}

/** Cobros de la plataforma: lo cobrado este mes, por moneda. */
export async function billingThisMonth() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db.billingPayment.groupBy({ by: ["currency"], where: { paidAt: { gte: from } }, _sum: { amountCents: true }, _count: { _all: true } });
  return rows.map((r) => ({ currency: r.currency, cents: r._sum.amountCents ?? 0, count: r._count._all }));
}
