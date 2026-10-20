"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES, CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { isValidDate, isValidTime, zonedToUtc } from "@/lib/booking";
import { db } from "@/lib/db";
import { newCode } from "@/lib/muro/data";
import { chatChannel, notifyChannel, wallChannel } from "@/lib/realtime/server";
import { getRegion } from "@/lib/region-server";
import { tableLabelOf } from "@/lib/table-session";

const admin = () => requireTenantRole(ADMIN_ROLES, "MURO");
/** Moderar y armar grupos: también caja y mozos (están en el salón). */
const floor = () => requireTenantRole(CAN_MANAGE_TABLES, "MURO");

function refresh() {
  revalidatePath("/admin/muro", "layout");
  revalidatePath("/staff", "layout");
}

// ─────────────────────────────────────────────────────────────
// Muros de evento
// ─────────────────────────────────────────────────────────────

const wallSchema = z.object({
  name: z.string().trim().min(2, "Poné un nombre (ej. Despedida de Juan)").max(60),
  date: z.string().refine(isValidDate, "Fecha no válida"),
  from: z.string().refine(isValidTime, "Hora no válida"),
  to: z.string().refine(isValidTime, "Hora no válida"),
  moderation: z.enum(["AUTO", "APPROVE"]),
});

export async function createWall(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await admin();
  const parsed = wallSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const { timezone } = await getRegion(tenant.id);
  const startsAt = zonedToUtc(d.date, d.from, timezone);
  let endsAt = zonedToUtc(d.date, d.to, timezone);
  // "21:00 a 04:00": termina al día siguiente.
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000);
  const wall = await tdb.wall.create({
    data: { tenantId: tenant.id, name: d.name, startsAt, endsAt, moderation: d.moderation, code: newCode(), screenToken: newCode(12) },
  });
  refresh();
  return { ...success(`Muro "${d.name}" creado`), id: wall.id } as ActionState;
}

export async function setWallModeration(id: string, moderation: "AUTO" | "APPROVE") {
  const { tdb } = await admin();
  await tdb.wall.update({ where: { id }, data: { moderation } });
  refresh();
}

export async function deleteWall(id: string) {
  const { tdb } = await admin();
  await tdb.wall.delete({ where: { id } });
  refresh();
  redirect("/admin/muro");
}

/** Aprobar, ocultar o volver a mostrar un mensaje del muro. */
export async function setWallMessage(id: string, status: "VISIBLE" | "HIDDEN") {
  const { tdb, tenant } = await floor();
  const m = await tdb.wallMessage.update({ where: { id }, data: { status } });
  await notifyChannel(wallChannel(tenant.id, m.wallId));
  refresh();
}

/** Bloquea a quien escribió y oculta todos sus mensajes en ese muro. */
export async function blockWallAuthor(messageId: string) {
  const { tdb, tenant } = await floor();
  const m = await tdb.wallMessage.findUniqueOrThrow({ where: { id: messageId }, include: { wall: true } });
  if (!m.wall.blockedKeys.includes(m.authorKey)) {
    await tdb.wall.update({ where: { id: m.wallId }, data: { blockedKeys: [...m.wall.blockedKeys, m.authorKey] } });
  }
  await tdb.wallMessage.updateMany({ where: { wallId: m.wallId, authorKey: m.authorKey }, data: { status: "HIDDEN" } });
  await notifyChannel(wallChannel(tenant.id, m.wallId));
  refresh();
}

/** Palabras propias del local (se suman a la lista general del país). */
export async function saveBlockedWords(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await admin();
  const words = [
    ...new Set(
      String(formData.get("words") ?? "")
        .split(/[,\n]/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2)
        .map((w) => w.slice(0, 30)),
    ),
  ].slice(0, 200);
  await db.tenantSettings.upsert({ where: { tenantId: tenant.id }, update: { blockedWords: words }, create: { tenantId: tenant.id, blockedWords: words } });
  refresh();
  return success(words.length ? `${words.length} palabras guardadas` : "Lista vacía: se usa solo la general");
}

// ─────────────────────────────────────────────────────────────
// Grupos de chat
// ─────────────────────────────────────────────────────────────

/** El mozo arma el grupo de una mesa (se cierra al cobrarla) o un grupo suelto del local. */
export async function createChatGroup(name: string, sessionId?: string | null): Promise<ActionState & { code?: string }> {
  const { tdb, tenant } = await floor();
  const n = name.replace(/\s+/g, " ").trim().slice(0, 40);
  if (n.length < 2) return { error: "Poné un nombre para el grupo" };
  let tableLabel: string | null = null;
  if (sessionId) {
    const session = await tdb.tableSession.findUnique({ where: { id: sessionId }, include: { table: true } });
    if (!session || session.status === "CLOSED") return { error: "La mesa no está abierta" };
    const open = await tdb.chatRoom.findFirst({ where: { sessionId, closedAt: null } });
    if (open) return { ...success("La mesa ya tiene un grupo"), code: open.code };
    tableLabel = await tableLabelOf(tdb, session.table);
  }
  const room = await tdb.chatRoom.create({ data: { tenantId: tenant.id, name: n, code: newCode(), sessionId: sessionId ?? null, tableLabel } });
  refresh();
  return { ...success(`Grupo "${n}" listo`), code: room.code };
}

export async function setChatMessageHidden(id: string, hidden: boolean) {
  const { tdb, tenant } = await floor();
  const m = await tdb.chatMessage.update({ where: { id }, data: { hidden, ...(hidden ? {} : { reportedBy: [] }) } });
  await notifyChannel(chatChannel(tenant.id, m.roomId));
  refresh();
}

export async function blockChatAuthor(messageId: string) {
  const { tdb, tenant } = await floor();
  const m = await tdb.chatMessage.findUniqueOrThrow({ where: { id: messageId }, include: { room: true } });
  if (!m.room.blockedKeys.includes(m.authorKey)) {
    await tdb.chatRoom.update({ where: { id: m.roomId }, data: { blockedKeys: [...m.room.blockedKeys, m.authorKey] } });
  }
  await tdb.chatMessage.updateMany({ where: { roomId: m.roomId, authorKey: m.authorKey }, data: { hidden: true } });
  await notifyChannel(chatChannel(tenant.id, m.roomId));
  refresh();
}

/** Cierra el grupo y borra sus mensajes (no queda nada guardado). */
export async function closeChatRoom(id: string, back?: string) {
  const { tdb, tenant } = await floor();
  await tdb.chatMessage.deleteMany({ where: { roomId: id } });
  await tdb.chatRoom.update({ where: { id }, data: { closedAt: new Date() } });
  await notifyChannel(chatChannel(tenant.id, id));
  refresh();
  if (back) redirect(back);
}
