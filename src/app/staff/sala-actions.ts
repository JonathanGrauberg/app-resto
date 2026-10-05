"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PrepStation, Role } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { notifyStaff, notifyTable } from "@/lib/realtime/server";
import { buildModifiers, unitPrice, type Modifier } from "@/lib/order-lines";
import { getPrepMode, routeStations } from "@/lib/prep";
import { ensureReceipt } from "@/lib/receipt";
import { tableLabelOf } from "@/lib/table-session";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Operación de sala en vivo: abrir/cerrar mesas, comensales, mozo, juntar/separar.
 * Ciclo: LIBRE → OCUPADA → PENDIENTE DE COBRO → (caja confirma) → LIBRE.
 */

const CASHIER_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA"];
const MAX_GUESTS = 99;

async function auth() {
  return requireTenantRole(CAN_MANAGE_TABLES);
}

/** Revalida y avisa en vivo: al personal del local y, si corresponde, a los comensales de esa mesa. */
async function refresh(tenantId: string, sessionId?: string) {
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
  await notifyStaff(tenantId, { type: "table" });
  if (sessionId) await notifyTable(tenantId, sessionId, { type: "session" });
}

const ok = (message: string): ActionState => ({ ok: message, at: Date.now() });
const err = (message: string): ActionState => ({ error: message });

/** Mesas que comparten grupo con `tableId` (incluida ella). */
async function groupTableIds(tdb: TenantDb, tableId: string) {
  const t = await tdb.table.findUniqueOrThrow({ where: { id: tableId } });
  if (!t.groupId) return [t.id];
  const all = await tdb.table.findMany({ where: { groupId: t.groupId }, select: { id: true } });
  return all.map((x) => x.id);
}

async function openSessionFor(tdb: TenantDb, tableIds: string[]) {
  return tdb.tableSession.findFirst({ where: { tableId: { in: tableIds }, status: { not: "CLOSED" } } });
}

// ─────────────────────────────────────────────────────────────
// Abrir mesa y comensales
// ─────────────────────────────────────────────────────────────

export async function openTable(tableId: string, guests: number): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  const table = await tdb.table.findUnique({ where: { id: tableId } });
  if (!table) return err("Mesa no encontrada");
  if (table.status === "DISABLED") return err("La mesa está deshabilitada");

  const ids = await groupTableIds(tdb, tableId);
  if (await openSessionFor(tdb, ids)) return err("La mesa ya está abierta");

  await tdb.tableSession.create({
    data: {
      tenantId: tenant.id,
      tableId,
      guests: Math.min(Math.max(1, Math.round(guests)), MAX_GUESTS),
      // El mozo que la abre queda asignado; caja/admin la abren sin mozo.
      waiterId: membership.role === "MOZO" ? membership.id : null,
    },
  });
  await tdb.table.updateMany({ where: { id: { in: ids } }, data: { status: "OCCUPIED" } });
  await refresh(tenant.id);
  return ok("Mesa abierta");
}

export async function setGuests(sessionId: string, guests: number): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const n = Math.round(guests);
  if (n < 1 || n > MAX_GUESTS) return err("Cantidad no válida");
  // Se permite superar el tope de la mesa (llega alguien más y se suma una silla).
  await tdb.tableSession.update({ where: { id: sessionId, status: { not: "CLOSED" } }, data: { guests: n } });
  await refresh(tenant.id, sessionId);
  return ok("Comensales actualizados");
}

// ─────────────────────────────────────────────────────────────
// Mozo asignado (uno solo por mesa)
// ─────────────────────────────────────────────────────────────

export async function assignWaiter(sessionId: string, waiterId: string | null): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  const session = await tdb.tableSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status === "CLOSED") return err("La mesa no está abierta");

  if (membership.role === "MOZO") {
    // Un mozo puede tomar una mesa sin mozo, o soltar la suya. No puede quitársela a otro.
    const takingFree = waiterId === membership.id && !session.waiterId;
    const releasingOwn = waiterId === null && session.waiterId === membership.id;
    if (!takingFree && !releasingOwn) return err("Esta mesa ya tiene otro mozo. Pedile a caja que la reasigne.");
  } else if (waiterId) {
    const w = await tdb.membership.findUnique({ where: { id: waiterId } });
    if (!w || !w.active || w.role !== "MOZO") return err("Mozo no válido");
  }

  await tdb.tableSession.update({ where: { id: sessionId }, data: { waiterId } });
  await refresh(tenant.id, sessionId);
  return ok(waiterId ? "Mozo asignado" : "Mesa sin mozo");
}

// ─────────────────────────────────────────────────────────────
// Juntar y separar mesas
// ─────────────────────────────────────────────────────────────

export async function joinTables(tableIds: string[]): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const unique = [...new Set(tableIds)];
  if (unique.length < 2) return err("Elegí al menos dos mesas");

  const picked = await tdb.table.findMany({ where: { id: { in: unique } } });
  if (picked.length !== unique.length) return err("Mesa no válida");
  if (picked.some((t) => t.status === "DISABLED")) return err("Hay una mesa deshabilitada");
  if (picked.some((t) => t.status === "PENDING_PAYMENT")) return err("No se puede juntar una mesa que está por cobrarse");

  // Si alguna ya estaba unida a otras, el grupo nuevo absorbe a todas.
  const oldGroups = [...new Set(picked.map((t) => t.groupId).filter((g): g is string => !!g))];
  const members = oldGroups.length
    ? await tdb.table.findMany({ where: { groupId: { in: oldGroups } }, select: { id: true } })
    : [];
  const all = [...new Set([...unique, ...members.map((m) => m.id)])];

  const sessions = await tdb.tableSession.findMany({ where: { tableId: { in: all }, status: { not: "CLOSED" } } });
  if (sessions.length > 1) {
    return err("Dos de esas mesas ya tienen comensales: cerrá o pasá una de ellas antes de juntarlas");
  }

  await tdb.$transaction(async (tx) => {
    const group = await tx.tableGroup.create({ data: { tenantId: tenant.id } });
    await tx.table.updateMany({
      where: { id: { in: all } },
      data: { groupId: group.id, ...(sessions.length ? { status: "OCCUPIED" } : {}) },
    });
    if (oldGroups.length) await tx.tableGroup.deleteMany({ where: { id: { in: oldGroups } } });
  });
  await refresh(tenant.id);
  return ok("Mesas juntadas");
}

/** Separa todas las mesas de un grupo. La que tiene la sesión sigue ocupada; las demás quedan libres. */
export async function separateTables(tableId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const table = await tdb.table.findUniqueOrThrow({ where: { id: tableId } });
  if (!table.groupId) return err("La mesa no está unida a otra");
  const ids = await groupTableIds(tdb, tableId);
  const session = await openSessionFor(tdb, ids);
  if (session?.status === "PENDING_PAYMENT") return err("La mesa está por cobrarse");

  await tdb.$transaction(async (tx) => {
    await tx.table.updateMany({ where: { id: { in: ids } }, data: { groupId: null } });
    if (session) {
      await tx.table.updateMany({ where: { id: { in: ids.filter((i) => i !== session.tableId) } }, data: { status: "FREE" } });
    }
    await tx.tableGroup.delete({ where: { id: table.groupId! } });
  });
  await refresh(tenant.id);
  return ok("Mesas separadas");
}

// ─────────────────────────────────────────────────────────────
// Cierre y cobro
// ─────────────────────────────────────────────────────────────

async function sessionTables(tdb: TenantDb, sessionId: string) {
  const session = await tdb.tableSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status === "CLOSED") return null;
  return { session, ids: await groupTableIds(tdb, session.tableId) };
}

/** El mozo pide cerrar: la mesa queda pendiente de cobro y su QR deja de aceptar pedidos. */
export async function requestClose(sessionId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  await tdb.tableSession.update({ where: { id: sessionId }, data: { status: "PENDING_PAYMENT", closeRequestedAt: new Date() } });
  // La cuenta (y su QR) queda lista para imprimir y para que la vean en sus celulares.
  await ensureReceipt(tdb, sessionId);
  await tdb.table.updateMany({ where: { id: { in: st.ids } }, data: { status: "PENDING_PAYMENT" } });
  await refresh(tenant.id, sessionId);
  return ok("Mesa enviada a caja para cobrar");
}

/** Deshace el pedido de cierre (por ejemplo, piden algo más). */
export async function reopenTable(sessionId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st || st.session.status !== "PENDING_PAYMENT") return err("La mesa no está pendiente de cobro");
  await tdb.tableSession.update({ where: { id: sessionId }, data: { status: "OPEN", closeRequestedAt: null } });
  await tdb.table.updateMany({ where: { id: { in: st.ids } }, data: { status: "OCCUPIED" } });
  await refresh(tenant.id, sessionId);
  return ok("Mesa reabierta");
}

async function finish(tdb: TenantDb, sessionId: string, ids: string[]) {
  const tables = await tdb.table.findMany({ where: { id: { in: ids } } });
  const session = await tdb.tableSession.findUniqueOrThrow({ where: { id: sessionId } });
  const groupId = tables.find((t) => t.groupId)?.groupId;
  const extras = tables.filter((t) => t.temporary);
  const fixed = tables.filter((t) => !t.temporary);

  await tdb.$transaction(async (tx) => {
    // Al cerrar la mesa no queda nada pendiente: lo aceptado se da por entregado y lo no aceptado se rechaza.
    await tx.orderItem.updateMany({
      where: { order: { sessionId, status: "ACCEPTED" }, status: { in: ["PENDING", "IN_PREPARATION", "READY"] } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await tx.order.updateMany({ where: { sessionId, status: "ACCEPTED" }, data: { status: "COMPLETED" } });
    await tx.order.updateMany({ where: { sessionId, status: "PENDING" }, data: { status: "REJECTED", rejectReason: "Mesa cerrada" } });

    // Si la sesión quedó en una mesa extra pero había mesas fijas, el historial pasa a una fija.
    const mainIsExtra = extras.some((t) => t.id === session.tableId);
    if (mainIsExtra && fixed.length) {
      await tx.tableSession.update({ where: { id: sessionId }, data: { tableId: fixed[0].id } });
    }
    await tx.tableSession.update({ where: { id: sessionId }, data: { status: "CLOSED", closedAt: new Date() } });
    // Al liberarse, las mesas juntadas vuelven a ser independientes.
    await tx.table.updateMany({ where: { id: { in: fixed.map((t) => t.id) } }, data: { status: "FREE", groupId: null } });

    // Mesas extra: se retiran del plano. Se borran, salvo la que conserva el historial (se archiva).
    for (const t of extras) {
      const keepsHistory = t.id === session.tableId && !fixed.length;
      if (keepsHistory) {
        await tx.table.update({
          where: { id: t.id },
          // El número se libera para la próxima mesa extra (X1 vuelve a estar disponible).
          data: { archivedAt: new Date(), groupId: null, status: "FREE", number: `${t.number}·${t.id.slice(-5)}` },
        });
      } else {
        const hasHistory = await tx.tableSession.count({ where: { tableId: t.id } });
        if (hasHistory) {
          await tx.table.update({
            where: { id: t.id },
            data: { archivedAt: new Date(), groupId: null, status: "FREE", number: `${t.number}·${t.id.slice(-5)}` },
          });
        } else {
          await tx.table.delete({ where: { id: t.id } });
        }
      }
    }
    if (groupId) await tx.tableGroup.delete({ where: { id: groupId } });
  });
}

/** Caja confirma el cobro: la mesa se libera y su QR vuelve a funcionar para los próximos comensales. */
export async function confirmPayment(sessionId: string): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  if (!CASHIER_ROLES.includes(membership.role)) return err("Solo caja puede confirmar el cobro");
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  if (st.session.status !== "PENDING_PAYMENT") return err("Primero hay que cerrar la mesa");
  await ensureReceipt(tdb, sessionId);
  // Total cobrado (para métricas). Se calcula de los pedidos, nunca del cliente.
  const items = await tdb.orderItem.findMany({
    where: { order: { sessionId, status: { not: "REJECTED" } }, status: { not: "CANCELLED" } },
    select: { unitPriceCents: true, quantity: true },
  });
  await tdb.tableSession.update({
    where: { id: sessionId },
    data: { totalCents: items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0) },
  });
  await finish(tdb, sessionId, st.ids);
  await refresh(tenant.id, sessionId);
  return ok("Cobro confirmado. Mesa libre.");
}

/** Abierta por error / se fueron sin consumir: se libera sin pasar por caja (solo si no hay pedidos). */
export async function releaseTable(sessionId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  const orders = await tdb.order.count({ where: { sessionId, status: { not: "REJECTED" } } });
  if (orders > 0) return err("La mesa tiene pedidos: hay que cerrarla y cobrarla");
  await finish(tdb, sessionId, st.ids);
  await refresh(tenant.id, sessionId);
  return ok("Mesa liberada");
}

// ─────────────────────────────────────────────────────────────
// Mesas extra (traídas del depósito o de otro salón durante el servicio)
// ─────────────────────────────────────────────────────────────

type Rect = { posX: number; posY: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) =>
  a.posX < b.posX + b.width && b.posX < a.posX + a.width && a.posY < b.posY + b.height && b.posY < a.posY + a.height;

/** Lugar libre en el plano: pegado a `near` si se puede (derecha, abajo, izquierda, arriba), si no el primero libre. */
function placeExtra(area: { width: number; height: number }, tables: Rect[], near: Rect | null) {
  const size = { width: 2, height: 2 };
  const fits = (r: Rect) =>
    r.posX >= 0 && r.posY >= 0 && r.posX + r.width <= area.width && r.posY + r.height <= area.height && !tables.some((t) => overlaps(t, r));
  if (near) {
    const candidates = [
      { posX: near.posX + near.width, posY: near.posY },
      { posX: near.posX, posY: near.posY + near.height },
      { posX: near.posX - size.width, posY: near.posY },
      { posX: near.posX, posY: near.posY - size.height },
    ];
    for (const c of candidates) if (fits({ ...c, ...size })) return { ...c, ...size };
  }
  for (let y = 0; y + size.height <= area.height; y++)
    for (let x = 0; x + size.width <= area.width; x++) if (fits({ posX: x, posY: y, ...size })) return { posX: x, posY: y, ...size };
  return null;
}

/**
 * Agrega una mesa extra al salón. Con `joinWith`, la ubica pegada a esa mesa y las junta
 * (ej. mesa 2 de dos personas + llegan cuatro → "2+X1").
 */
export async function addExtraTable(areaId: string, seats: number, joinWith?: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const n = Math.min(Math.max(1, Math.round(seats)), 20);
  const area = await tdb.area.findUnique({ where: { id: areaId }, include: { tables: { where: { archivedAt: null } } } });
  if (!area) return err("Salón no encontrado");

  const target = joinWith ? area.tables.find((t) => t.id === joinWith) ?? null : null;
  if (joinWith && !target) return err("Mesa no encontrada en este salón");
  if (target?.status === "PENDING_PAYMENT") return err("La mesa está por cobrarse");

  const spot = placeExtra(area, area.tables, target);
  if (!spot) return err("No queda lugar libre en el plano de este salón");

  // Numeración X1, X2… reutilizando los números libres.
  const used = new Set((await tdb.table.findMany({ where: { number: { startsWith: "X" } }, select: { number: true } })).map((t) => t.number));
  let i = 1;
  while (used.has(`X${i}`)) i++;

  const extra = await tdb.table.create({
    data: {
      tenantId: tenant.id,
      areaId,
      number: `X${i}`,
      seats: n,
      maxGuests: n,
      shape: "SQUARE",
      ...spot,
      temporary: true,
      qrToken: randomBytes(12).toString("base64url"),
    },
  });

  if (target) {
    const res = await joinTables([target.id, extra.id]);
    if (res?.error) return res;
    return ok(`Mesa X${i} sumada`);
  }
  await refresh(tenant.id);
  return ok(`Mesa extra X${i} agregada`);
}

/** Quita una mesa extra que quedó libre (por ejemplo, se separó y ya no hace falta). */
export async function removeExtraTable(tableId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const t = await tdb.table.findUnique({ where: { id: tableId } });
  if (!t || !t.temporary) return err("Solo se pueden quitar mesas extra");
  if (t.groupId) return err("Separala antes de quitarla");
  if (await openSessionFor(tdb, [t.id])) return err("La mesa tiene comensales");
  const history = await tdb.tableSession.count({ where: { tableId } });
  if (history) {
    await tdb.table.update({ where: { id: tableId }, data: { archivedAt: new Date(), number: `${t.number}·${t.id.slice(-5)}` } });
  } else {
    await tdb.table.delete({ where: { id: tableId } });
  }
  await refresh(tenant.id);
  return ok("Mesa extra quitada");
}

// ─────────────────────────────────────────────────────────────
// Pedidos de los comensales y llamadas al mozo
// ─────────────────────────────────────────────────────────────

async function orderWithSession(tdb: TenantDb, orderId: string) {
  return tdb.order.findUnique({
    where: { id: orderId },
    include: { session: { include: { table: true } }, items: { select: { station: true } } },
  });
}

/** El mozo valida el pedido: pasa a cocina/bar. Si la mesa no tenía mozo, queda asignada a quien lo acepta. */
export async function acceptOrder(orderId: string): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  const order = await orderWithSession(tdb, orderId);
  if (!order) return err("Pedido no encontrado");
  if (order.status !== "PENDING") return err("Ese pedido ya fue procesado");
  if (membership.role === "MOZO" && order.session.waiterId && order.session.waiterId !== membership.id) {
    return err("Es una mesa de otro mozo");
  }

  await tdb.order.update({
    where: { id: orderId },
    data: { status: "ACCEPTED", acceptedById: membership.id, acceptedAt: new Date() },
  });
  if (!order.session.waiterId && membership.role === "MOZO") {
    await tdb.tableSession.update({ where: { id: order.sessionId }, data: { waiterId: membership.id } });
  }
  // Lo que no se prepara (agua, una lata…) queda listo para que el mozo lo lleve directo.
  await tdb.orderItem.updateMany({ where: { orderId, station: "NONE" }, data: { status: "READY", readyAt: new Date() } });
  await notifyStaff(tenant.id, { type: "order.updated", sessionId: order.sessionId, orderId });
  const stations = routeStations(await getPrepMode(tenant.id), order.items.map((i) => i.station));
  if (stations.length) {
    await notifyStaff(tenant.id, { type: "kitchen.new", tableLabel: await tableLabelOf(tdb, order.session.table), stations });
  }
  await notifyTable(tenant.id, order.sessionId, { type: "order", orderId });
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
  return ok("Pedido aceptado y enviado a preparación");
}

export async function rejectOrder(orderId: string, reason: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const order = await orderWithSession(tdb, orderId);
  if (!order) return err("Pedido no encontrado");
  if (order.status !== "PENDING") return err("Ese pedido ya fue procesado");
  await tdb.order.update({
    where: { id: orderId },
    data: { status: "REJECTED", rejectReason: reason.trim().slice(0, 140) || null },
  });
  await notifyStaff(tenant.id, { type: "order.updated", sessionId: order.sessionId, orderId });
  await notifyTable(tenant.id, order.sessionId, { type: "order", orderId });
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
  return ok("Pedido rechazado");
}

/** "Ya fui": apaga el aviso de mesa que llama al mozo. */
export async function dismissCall(sessionId: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  await tdb.tableSession.update({ where: { id: sessionId }, data: { waiterCalledAt: null } });
  await refresh(tenant.id, sessionId);
  return ok("Llamada atendida");
}

// ─────────────────────────────────────────────────────────────
// Pedido cargado por el mozo (mesa sin celular, o que prefiere pedirle al mozo)
// ─────────────────────────────────────────────────────────────

export type StaffOrderLine = {
  productId: string;
  quantity: number;
  optionIds: string[];
  notes?: string;
  /** Para quién es (apodo); vacío = "Mesa". */
  who?: string;
};

/** Entra ya aceptado: va directo a cocina/bar. Precios y opciones se validan contra la carta. */
export async function createStaffOrder(sessionId: string, lines: StaffOrderLine[]): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  if (!Array.isArray(lines) || lines.length === 0) return err("El pedido está vacío");
  if (lines.length > 60) return err("Demasiadas líneas en un solo pedido");

  const session = await tdb.tableSession.findUnique({ where: { id: sessionId }, include: { table: true } });
  if (!session || session.status === "CLOSED") return err("La mesa no está abierta");
  if (session.status === "PENDING_PAYMENT") return err("La mesa está por cobrarse: reabrila para sumar pedidos");

  const products = await tdb.product.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.productId))] } },
    include: { modifierGroups: { include: { group: { include: { options: true } } } } },
  });

  const items: {
    tenantId: string;
    productId: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    modifiers: Modifier[];
    notes: string | null;
    station: PrepStation;
    status: "READY" | "PENDING";
    readyAt: Date | null;
    addedBy: string | null;
    addedById: string | null;
  }[] = [];
  for (const l of lines) {
    const product = products.find((p) => p.id === l.productId);
    if (!product) return err("Hay un plato que ya no está en la carta");
    if (!product.available) return err(`${product.name} está agotado`);
    const qty = Math.round(l.quantity);
    if (!(qty >= 1 && qty <= 50)) return err("Cantidad no válida");
    const built = buildModifiers(product.modifierGroups.map((m) => m.group), l.optionIds ?? []);
    if ("error" in built) return err(`${product.name}: ${built.error}`);
    const who = (l.who ?? "").trim().slice(0, 20);
    items.push({
      tenantId: tenant.id,
      productId: product.id,
      name: product.name,
      unitPriceCents: unitPrice(product.priceCents, built.modifiers),
      quantity: qty,
      modifiers: built.modifiers,
      notes: (l.notes ?? "").trim().slice(0, 140) || null,
      station: product.station,
      // Lo que no se prepara queda listo para que el mozo lo lleve.
      status: product.station === "NONE" ? ("READY" as const) : ("PENDING" as const),
      readyAt: product.station === "NONE" ? new Date() : null,
      // Mismo "id" para el mismo nombre dentro de la mesa: así el consumo por persona agrupa bien.
      addedBy: who || null,
      addedById: who ? `mozo:${who.toLowerCase()}` : null,
    });
  }

  const order = await tdb.$transaction(async (tx) => {
    const last = await tx.order.findFirst({ where: { sessionId }, orderBy: { round: "desc" } });
    const created = await tx.order.create({
      data: {
        tenantId: tenant.id,
        sessionId,
        round: (last?.round ?? 0) + 1,
        status: "ACCEPTED",
        source: "STAFF",
        createdById: membership.id,
        acceptedById: membership.id,
        acceptedAt: new Date(),
        items: { create: items },
      },
    });
    // Si la mesa no tenía mozo y lo carga un mozo, queda a su cargo.
    if (!session.waiterId && membership.role === "MOZO") {
      await tx.tableSession.update({ where: { id: sessionId }, data: { waiterId: membership.id } });
    }
    return created;
  });

  const label = await tableLabelOf(tdb, session.table);
  const stations = routeStations(await getPrepMode(tenant.id), items.map((i) => i.station));
  if (stations.length) await notifyStaff(tenant.id, { type: "kitchen.new", tableLabel: label, stations });
  await notifyStaff(tenant.id, { type: "order.updated", sessionId, orderId: order.id });
  await notifyTable(tenant.id, sessionId, { type: "order", orderId: order.id });
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
  return ok(stations.length ? "Pedido enviado a cocina" : "Pedido cargado");
}
