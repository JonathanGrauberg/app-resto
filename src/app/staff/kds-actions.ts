"use server";

import { revalidatePath } from "next/cache";
import type { PrepStation, Role } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { notifyStaff, notifyTable } from "@/lib/realtime/server";
import { tableLabelOf } from "@/lib/table-session";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Cocina / bar marcan el avance de los platos; el mozo marca la entrega.
 * PENDING → IN_PREPARATION → READY (aviso al mozo) → DELIVERED.
 */

const KITCHEN_ROLES: Role[] = ["OWNER", "ADMIN", "COCINA", "BAR"];
const DELIVER_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA", "MOZO"];

/** Cocina solo toca platos de cocina; bar, los de bar. Dueño/admin, cualquiera. */
function allowedStation(role: Role): PrepStation | null {
  if (role === "COCINA") return "KITCHEN";
  if (role === "BAR") return "BAR";
  return null; // sin restricción
}

const ok = (message: string): ActionState => ({ ok: message, at: Date.now() });
const err = (message: string): ActionState => ({ error: message });

async function loadItems(tdb: TenantDb, itemIds: string[], role: Role) {
  const station = allowedStation(role);
  return tdb.orderItem.findMany({
    where: { id: { in: itemIds }, ...(station ? { station } : {}), order: { status: "ACCEPTED" } },
    include: { order: { include: { session: { include: { table: true } } } } },
  });
}

function refresh() {
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
}

export async function startItems(itemIds: string[]): Promise<ActionState> {
  const { tdb, tenant, membership } = await requireTenantRole(KITCHEN_ROLES);
  const items = await loadItems(tdb, itemIds, membership.role);
  const ids = items.filter((i) => i.status === "PENDING").map((i) => i.id);
  if (!ids.length) return ok("Sin cambios");
  await tdb.orderItem.updateMany({ where: { id: { in: ids } }, data: { status: "IN_PREPARATION" } });
  await notifyStaff(tenant.id, { type: "table" });
  for (const sid of new Set(items.map((i) => i.order.sessionId))) await notifyTable(tenant.id, sid, { type: "order", orderId: "" });
  refresh();
  return ok("En preparación");
}

/** ¡Listo! Avisa al mozo de la mesa (o a todos si no tiene) para que lo lleve. */
export async function readyItems(itemIds: string[]): Promise<ActionState> {
  const { tdb, tenant, membership } = await requireTenantRole(KITCHEN_ROLES);
  const items = await loadItems(tdb, itemIds, membership.role);
  const ready = items.filter((i) => i.status === "PENDING" || i.status === "IN_PREPARATION");
  if (!ready.length) return ok("Sin cambios");
  await tdb.orderItem.updateMany({ where: { id: { in: ready.map((i) => i.id) } }, data: { status: "READY", readyAt: new Date() } });

  // Un aviso por mesa, con lo que hay que llevar.
  const bySession = new Map<string, typeof ready>();
  for (const i of ready) bySession.set(i.order.sessionId, [...(bySession.get(i.order.sessionId) ?? []), i]);
  for (const [sessionId, list] of bySession) {
    const session = list[0].order.session;
    await notifyStaff(tenant.id, {
      type: "item.ready",
      tableLabel: await tableLabelOf(tdb, session.table),
      sessionId,
      waiterId: session.waiterId,
      station: list[0].station,
      summary: list.map((i) => `${i.quantity}× ${i.name}`).join(", "),
    });
    await notifyTable(tenant.id, sessionId, { type: "order", orderId: list[0].orderId });
  }
  refresh();
  return ok("¡Listo! Avisamos al mozo");
}

/** Por si se marcó "listo" sin querer. */
export async function undoReady(itemIds: string[]): Promise<ActionState> {
  const { tdb, tenant, membership } = await requireTenantRole(KITCHEN_ROLES);
  const items = await loadItems(tdb, itemIds, membership.role);
  const ids = items.filter((i) => i.status === "READY").map((i) => i.id);
  if (!ids.length) return ok("Sin cambios");
  await tdb.orderItem.updateMany({ where: { id: { in: ids } }, data: { status: "IN_PREPARATION", readyAt: null } });
  await notifyStaff(tenant.id, { type: "table" });
  refresh();
  return ok("Vuelto a preparación");
}

/** El mozo entrega en la mesa. Cuando todo el pedido está entregado, el pedido queda completo. */
export async function deliverItems(itemIds: string[]): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(DELIVER_ROLES);
  const items = await tdb.orderItem.findMany({
    where: { id: { in: itemIds }, status: { in: ["READY", "IN_PREPARATION", "PENDING"] }, order: { status: "ACCEPTED" } },
    select: { id: true, orderId: true, order: { select: { sessionId: true } } },
  });
  if (!items.length) return err("Nada para entregar");
  await tdb.orderItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { status: "DELIVERED", deliveredAt: new Date() } });

  for (const orderId of new Set(items.map((i) => i.orderId))) {
    const open = await tdb.orderItem.count({ where: { orderId, status: { notIn: ["DELIVERED", "CANCELLED"] } } });
    if (open === 0) await tdb.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
  }
  await notifyStaff(tenant.id, { type: "table" });
  for (const sid of new Set(items.map((i) => i.order.sessionId))) await notifyTable(tenant.id, sid, { type: "order", orderId: "" });
  refresh();
  return ok("Entregado");
}
