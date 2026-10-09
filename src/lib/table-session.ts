import "server-only";
import { db } from "@/lib/db";
import { readDiner, type Diner } from "@/lib/diner";
import { tenantDb, type TenantDb } from "@/lib/tenant-db";

/**
 * Contexto de una mesa a partir del QR: local, mesa, mesas juntadas y sesión abierta.
 * Lo usan la página del comensal y sus acciones.
 */
export async function tableContext(slug: string, qrToken: string) {
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { settings: true } });
  if (!tenant?.active) return null;
  const tdb = tenantDb(tenant.id);
  const table = await tdb.table.findFirst({ where: { qrToken, archivedAt: null } });
  if (!table) return null;

  const members = table.groupId
    ? await tdb.table.findMany({ where: { groupId: table.groupId, archivedAt: null } })
    : [table];
  const session = await tdb.tableSession.findFirst({
    where: { tableId: { in: members.map((m) => m.id) }, status: { not: "CLOSED" } },
  });
  const label = members
    .map((m) => m.number)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .join("+");

  return { tenant, tdb, table, members, session, label };
}

export type TableContext = NonNullable<Awaited<ReturnType<typeof tableContext>>>;

/** Comensal válido para ESTA mesa: cookie firmada + sesión abierta de esta mesa (o su grupo). */
export async function currentDiner(ctx: TableContext): Promise<Diner | null> {
  const d = await readDiner(ctx.tenant.id);
  if (!d || !ctx.session || d.sessionId !== ctx.session.id) return null;
  return d;
}

/** Estado que ve el comensal: carrito compartido y pedidos de la mesa. */
export async function dinerTableState(ctx: TableContext) {
  if (!ctx.session) return { cart: [], orders: [] };
  const [cart, orders] = await Promise.all([
    ctx.tdb.cartItem.findMany({
      where: { sessionId: ctx.session.id },
      orderBy: { createdAt: "asc" },
      include: { product: { select: { name: true, priceCents: true, imageUrl: true, available: true } } },
    }),
    ctx.tdb.order.findMany({
      where: { sessionId: ctx.session.id },
      orderBy: { round: "asc" },
      include: { items: { orderBy: { id: "asc" } } },
    }),
  ]);
  return {
    cart: cart.map((c) => ({
      id: c.id,
      productId: c.productId,
      name: c.product.name,
      imageUrl: c.product.imageUrl,
      available: c.product.available,
      quantity: c.quantity,
      modifiers: (c.modifiers as { name: string; extraPriceCents: number }[]) ?? [],
      notes: c.notes,
      addedBy: c.addedBy,
      addedById: c.addedById,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      round: o.round,
      status: o.status,
      rejectReason: o.rejectReason,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        status: i.status,
        cancelReason: i.cancelReason,
        modifiers: (i.modifiers as { name: string }[]) ?? [],
        notes: i.notes,
        addedBy: i.addedBy,
        addedById: i.addedById,
      })),
    })),
  };
}

export type DinerTableState = Awaited<ReturnType<typeof dinerTableState>>;

/** Nombre de la mesa incluyendo las juntadas ("3+4"). */
export async function tableLabelOf(tdb: TenantDb, table: { number: string; groupId: string | null }) {
  if (!table.groupId) return table.number;
  const members = await tdb.table.findMany({ where: { groupId: table.groupId }, select: { number: true } });
  return members
    .map((m) => m.number)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .join("+");
}
