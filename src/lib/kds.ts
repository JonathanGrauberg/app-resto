import "server-only";
import type { PrepStation } from "@/generated/prisma/enums";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Pantalla de cocina / bar (KDS): pedidos ya aceptados por el mozo, de una estación,
 * agrupados por pedido de mesa. Los "listos" quedan visibles hasta que el mozo los entrega.
 */
export async function getKdsData(tdb: TenantDb, stations: PrepStation[]) {
  const orders = await tdb.order.findMany({
    where: {
      status: "ACCEPTED",
      // Solo mesas abiertas: una mesa cobrada no puede quedar "colgada" en cocina.
      session: { status: { not: "CLOSED" } },
      items: { some: { station: { in: stations }, status: { in: ["PENDING", "IN_PREPARATION", "READY"] } } },
    },
    orderBy: { acceptedAt: "asc" },
    include: {
      items: {
        where: { station: { in: stations }, status: { in: ["PENDING", "IN_PREPARATION", "READY"] } },
        orderBy: { id: "asc" },
      },
      session: {
        include: {
          table: { select: { number: true, groupId: true } },
          waiter: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  // Nombre de mesa con las juntadas ("3+4").
  const groupIds = [...new Set(orders.map((o) => o.session.table.groupId).filter((g): g is string => !!g))];
  const grouped = groupIds.length
    ? await tdb.table.findMany({ where: { groupId: { in: groupIds } }, select: { number: true, groupId: true } })
    : [];
  const labelFor = (t: { number: string; groupId: string | null }) =>
    t.groupId
      ? grouped
          .filter((g) => g.groupId === t.groupId)
          .map((g) => g.number)
          .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
          .join("+")
      : t.number;

  return orders.map((o) => ({
    id: o.id,
    tableLabel: labelFor(o.session.table),
    waiterName: o.session.waiter?.user.name ?? null,
    acceptedAt: (o.acceptedAt ?? o.createdAt).toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      modifiers: ((i.modifiers as { name: string }[]) ?? []).map((m) => m.name),
      notes: i.notes,
      addedBy: i.addedBy,
      status: i.status as "PENDING" | "IN_PREPARATION" | "READY",
      readyAt: i.readyAt?.toISOString() ?? null,
    })),
  }));
}

export type KdsOrder = Awaited<ReturnType<typeof getKdsData>>[number];
