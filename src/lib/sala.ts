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
      include: { waiter: { include: { user: { select: { name: true } } } } },
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
    })),
    waiters: waiters
      .map((w) => ({ id: w.id, name: w.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type SalaData = Awaited<ReturnType<typeof getSalaData>>;
export type SalaTable = SalaData["areas"][number]["tables"][number];
export type SalaSession = SalaData["sessions"][number];
