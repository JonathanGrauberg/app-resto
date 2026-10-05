import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/** Estado completo de la sala para la vista en vivo (mozo / caja). Serializable. */
export async function getSalaData(tdb: TenantDb) {
  const [areas, sessions, waiters] = await Promise.all([
    tdb.area.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tables: { where: { archivedAt: null }, orderBy: { number: "asc" } } },
    }),
    tdb.tableSession.findMany({
      where: { status: { not: "CLOSED" } },
      include: {
        waiter: { include: { user: { select: { name: true } } } },
        orders: {
          where: { status: { not: "REJECTED" } },
          orderBy: { round: "asc" },
          include: { items: { orderBy: { id: "asc" } } },
        },
      },
    }),
    tdb.membership.findMany({
      where: { role: "MOZO", active: true },
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    areas: areas.map((a) => ({
      id: a.id,
      name: a.name,
      width: a.width,
      height: a.height,
      tables: a.tables.map((t) => ({
        id: t.id,
        number: t.number,
        seats: t.seats,
        maxGuests: t.maxGuests,
        shape: t.shape,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        status: t.status,
        groupId: t.groupId,
        temporary: t.temporary,
        qrToken: t.qrToken,
      })),
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      tableId: s.tableId,
      guests: s.guests,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closeRequestedAt: s.closeRequestedAt?.toISOString() ?? null,
      waiterId: s.waiterId,
      waiterName: s.waiter?.user.name ?? null,
      waiterCalledAt: s.waiterCalledAt?.toISOString() ?? null,
      pendingOrders: s.orders.filter((o) => o.status === "PENDING").length,
      readyItems: s.orders
        .filter((o) => o.status === "ACCEPTED")
        .reduce((n, o) => n + o.items.filter((i) => i.status === "READY").length, 0),
      orders: s.orders.map((o) => ({
        id: o.id,
        round: o.round,
        status: o.status,
        source: o.source,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          modifiers: ((i.modifiers as { name: string }[]) ?? []).map((m) => m.name),
          notes: i.notes,
          addedBy: i.addedBy,
          addedById: i.addedById,
          status: i.status,
        })),
      })),
    })),
    waiters: waiters
      .map((w) => ({ id: w.id, name: w.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Mesas cobradas en las últimas 18 h (jornada), para reimprimir la cuenta desde caja. */
export async function getClosedToday(tdb: TenantDb) {
  const since = new Date(Date.now() - 18 * 60 * 60 * 1000);
  const rows = await tdb.tableSession.findMany({
    where: { status: "CLOSED", closedAt: { gte: since }, totalCents: { gt: 0 } },
    orderBy: { closedAt: "desc" },
    take: 60,
    include: { table: { select: { number: true } }, waiter: { include: { user: { select: { name: true } } } } },
  });
  return rows.map((s) => ({
    id: s.id,
    label: s.tableLabel ?? s.table.number,
    closedAt: s.closedAt!.toISOString(),
    totalCents: s.totalCents ?? 0,
    guests: s.guests,
    waiterName: s.waiter?.user.name ?? null,
  }));
}

export type SalaData = Awaited<ReturnType<typeof getSalaData>>;
export type SalaTable = SalaData["areas"][number]["tables"][number];
export type SalaSession = SalaData["sessions"][number];
