"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
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

function refresh() {
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
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
  refresh();
  return ok("Mesa abierta");
}

export async function setGuests(sessionId: string, guests: number): Promise<ActionState> {
  const { tdb } = await auth();
  const n = Math.round(guests);
  if (n < 1 || n > MAX_GUESTS) return err("Cantidad no válida");
  // Se permite superar el tope de la mesa (llega alguien más y se suma una silla).
  await tdb.tableSession.update({ where: { id: sessionId, status: { not: "CLOSED" } }, data: { guests: n } });
  refresh();
  return ok("Comensales actualizados");
}

// ─────────────────────────────────────────────────────────────
// Mozo asignado (uno solo por mesa)
// ─────────────────────────────────────────────────────────────

export async function assignWaiter(sessionId: string, waiterId: string | null): Promise<ActionState> {
  const { tdb, membership } = await auth();
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
  refresh();
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
  refresh();
  return ok("Mesas juntadas");
}

/** Separa todas las mesas de un grupo. La que tiene la sesión sigue ocupada; las demás quedan libres. */
export async function separateTables(tableId: string): Promise<ActionState> {
  const { tdb } = await auth();
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
  refresh();
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
  const { tdb } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  await tdb.tableSession.update({ where: { id: sessionId }, data: { status: "PENDING_PAYMENT", closeRequestedAt: new Date() } });
  await tdb.table.updateMany({ where: { id: { in: st.ids } }, data: { status: "PENDING_PAYMENT" } });
  refresh();
  return ok("Mesa enviada a caja para cobrar");
}

/** Deshace el pedido de cierre (por ejemplo, piden algo más). */
export async function reopenTable(sessionId: string): Promise<ActionState> {
  const { tdb } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st || st.session.status !== "PENDING_PAYMENT") return err("La mesa no está pendiente de cobro");
  await tdb.tableSession.update({ where: { id: sessionId }, data: { status: "OPEN", closeRequestedAt: null } });
  await tdb.table.updateMany({ where: { id: { in: st.ids } }, data: { status: "OCCUPIED" } });
  refresh();
  return ok("Mesa reabierta");
}

async function finish(tdb: TenantDb, sessionId: string, ids: string[]) {
  const tables = await tdb.table.findMany({ where: { id: { in: ids } } });
  const session = await tdb.tableSession.findUniqueOrThrow({ where: { id: sessionId } });
  const groupId = tables.find((t) => t.groupId)?.groupId;
  const extras = tables.filter((t) => t.temporary);
  const fixed = tables.filter((t) => !t.temporary);

  await tdb.$transaction(async (tx) => {
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
  const { tdb, membership } = await auth();
  if (!CASHIER_ROLES.includes(membership.role)) return err("Solo caja puede confirmar el cobro");
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  if (st.session.status !== "PENDING_PAYMENT") return err("Primero hay que cerrar la mesa");
  await finish(tdb, sessionId, st.ids);
  refresh();
  return ok("Cobro confirmado. Mesa libre.");
}

/** Abierta por error / se fueron sin consumir: se libera sin pasar por caja (solo si no hay pedidos). */
export async function releaseTable(sessionId: string): Promise<ActionState> {
  const { tdb } = await auth();
  const st = await sessionTables(tdb, sessionId);
  if (!st) return err("La mesa no está abierta");
  const orders = await tdb.order.count({ where: { sessionId, status: { not: "REJECTED" } } });
  if (orders > 0) return err("La mesa tiene pedidos: hay que cerrarla y cobrarla");
  await finish(tdb, sessionId, st.ids);
  refresh();
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
  refresh();
  return ok(`Mesa extra X${i} agregada`);
}

/** Quita una mesa extra que quedó libre (por ejemplo, se separó y ya no hace falta). */
export async function removeExtraTable(tableId: string): Promise<ActionState> {
  const { tdb } = await auth();
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
  refresh();
  return ok("Mesa extra quitada");
}
