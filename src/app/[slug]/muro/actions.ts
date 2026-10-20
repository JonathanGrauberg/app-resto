"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readGuest, saveGuest } from "@/lib/muro/guest";
import { ROOM_TTL_MS, checkText, muroTenant, newCode, tooFast, wallOpen } from "@/lib/muro/data";
import { findBlocked } from "@/lib/muro/filter";
import { tableLabelOf } from "@/lib/table-session";
import { tenantDb } from "@/lib/tenant-db";
import { chatChannel, notifyChannel, notifyStaff, wallChannel } from "@/lib/realtime/server";

type Result = { ok?: string; error?: string };

/** Confirma +18 y las reglas, con el apodo con el que va a aparecer. */
export async function joinMuro(slug: string, name: string, adult: boolean, rules: boolean): Promise<Result> {
  const ctx = await muroTenant(slug);
  if (!ctx) return { error: "Este local no tiene el Muro activo" };
  if (!adult) return { error: "Tenés que ser mayor de 18 años para participar" };
  if (!rules) return { error: "Tenés que aceptar las reglas para participar" };
  const n = name.replace(/\s+/g, " ").trim().slice(0, 20);
  if (n.length < 2) return { error: "Poné un apodo (mínimo 2 letras)" };
  if (findBlocked(n, ctx.region.country, ctx.blockedWords)) return { error: "Ese apodo no está permitido" };
  await saveGuest(n);
  return { ok: "¡Listo!" };
}

export async function postToWall(slug: string, code: string, text: string): Promise<Result> {
  const ctx = await muroTenant(slug);
  const guest = await readGuest();
  if (!ctx) return { error: "Este local no tiene el Muro activo" };
  if (!guest) return { error: "Primero confirmá tu edad y aceptá las reglas" };
  const wall = await db.wall.findFirst({ where: { code, tenantId: ctx.tenant.id } });
  if (!wall) return { error: "Este muro no existe" };
  if (!wallOpen(wall)) return { error: "El muro de este evento no está abierto ahora" };
  if (wall.blockedKeys.includes(guest.key)) return { error: "El local te bloqueó en este muro" };
  const checked = checkText(text, ctx.region.country, ctx.blockedWords);
  if ("error" in checked) return { error: checked.error };
  const recent = await db.wallMessage.findMany({
    where: { wallId: wall.id, authorKey: guest.key, createdAt: { gte: new Date(Date.now() - 60_000) } },
    select: { createdAt: true },
  });
  const fast = tooFast(recent.map((r) => r.createdAt));
  if (fast) return { error: fast };

  const pending = wall.moderation === "APPROVE";
  await db.wallMessage.create({
    data: { tenantId: ctx.tenant.id, wallId: wall.id, authorKey: guest.key, authorName: guest.name, text: checked.text, status: pending ? "PENDING" : "VISIBLE" },
  });
  await notifyChannel(wallChannel(ctx.tenant.id, wall.id));
  await notifyStaff(ctx.tenant.id, { type: "muro" });
  revalidatePath(`/${slug}/muro/${code}`);
  return { ok: pending ? "¡Enviado! Aparece en pantalla cuando el local lo apruebe." : "¡Ya está en el muro!" };
}

async function openRoom(tenantId: string, code: string) {
  const room = await db.chatRoom.findFirst({ where: { code, tenantId } });
  if (!room || room.closedAt) return null;
  // Grupo suelto viejo: se cierra solo (y se borran sus mensajes).
  if (!room.sessionId && Date.now() - room.createdAt.getTime() > ROOM_TTL_MS) {
    await db.$transaction([
      db.chatMessage.deleteMany({ where: { roomId: room.id } }),
      db.chatRoom.update({ where: { id: room.id }, data: { closedAt: new Date(), photoData: null, photoBy: null } }),
    ]);
    return null;
  }
  return room;
}

export async function postToChat(slug: string, code: string, text: string): Promise<Result> {
  const ctx = await muroTenant(slug);
  const guest = await readGuest();
  if (!ctx) return { error: "Este local no tiene el chat activo" };
  if (!guest) return { error: "Primero confirmá tu edad y aceptá las reglas" };
  const room = await openRoom(ctx.tenant.id, code);
  if (!room) return { error: "Este chat ya se cerró" };
  if (room.blockedKeys.includes(guest.key)) return { error: "El local te bloqueó en este chat" };
  const checked = checkText(text, ctx.region.country, ctx.blockedWords);
  if ("error" in checked) return { error: checked.error };
  const recent = await db.chatMessage.findMany({
    where: { roomId: room.id, authorKey: guest.key, createdAt: { gte: new Date(Date.now() - 60_000) } },
    select: { createdAt: true },
  });
  const fast = tooFast(recent.map((r) => r.createdAt));
  if (fast) return { error: fast };
  await db.chatMessage.create({
    data: { tenantId: ctx.tenant.id, roomId: room.id, authorKey: guest.key, authorName: guest.name, text: checked.text },
  });
  await notifyChannel(chatChannel(ctx.tenant.id, room.id));
  revalidatePath(`/${slug}/chat/${code}`);
  return { ok: "Enviado" };
}

/** Reportar un mensaje: con 2 reportes de personas distintas se oculta solo, y el local lo ve para revisar. */
export async function reportChatMessage(slug: string, code: string, messageId: string): Promise<Result> {
  const ctx = await muroTenant(slug);
  const guest = await readGuest();
  if (!ctx || !guest) return { error: "No se pudo reportar" };
  const room = await openRoom(ctx.tenant.id, code);
  if (!room) return { error: "Este chat ya se cerró" };
  const msg = await db.chatMessage.findFirst({ where: { id: messageId, roomId: room.id } });
  if (!msg) return { error: "Mensaje no encontrado" };
  if (msg.authorKey === guest.key) return { error: "No podés reportar tu propio mensaje" };
  if (!msg.reportedBy.includes(guest.key)) {
    const reportedBy = [...msg.reportedBy, guest.key];
    await db.chatMessage.update({ where: { id: msg.id }, data: { reportedBy, hidden: msg.hidden || reportedBy.length >= 2 } });
    await notifyChannel(chatChannel(ctx.tenant.id, room.id));
    await notifyStaff(ctx.tenant.id, { type: "muro" });
  }
  revalidatePath(`/${slug}/chat/${code}`);
  return { ok: "Gracias. El local lo va a revisar." };
}

// ─────────────────────────────────────────────────────────────
// Brindis: invitar a otra mesa a un chat compartido
// ─────────────────────────────────────────────────────────────

/** Un brindis vence a los 30 minutos (si va por el mozo, le da tiempo a preguntar). */
const INVITE_TTL_MS = 30 * 60_000;
/** Brindis que puede mandar una mesa en toda la noche. */
const MAX_BRINDIS = 6;
const label = (r: { tableLabel: string | null; name: string }) => (r.tableLabel ? `Mesa ${r.tableLabel}` : r.name);

/** Grupo abierto + quien escribe, que tiene que haber entrado al grupo (no alcanza con tener el código). */
async function memberContext(slug: string, code: string) {
  const ctx = await muroTenant(slug);
  const guest = await readGuest();
  if (!ctx || !guest) return null;
  const room = await openRoom(ctx.tenant.id, code);
  if (!room || !room.memberKeys.includes(guest.key) || room.blockedKeys.includes(guest.key)) return null;
  return { ctx, guest, room };
}

async function refreshRooms(slug: string, tenantId: string, rooms: { id: string; code: string }[]) {
  for (const r of rooms) {
    await notifyChannel(chatChannel(tenantId, r.id));
    revalidatePath(`/${slug}/chat/${r.code}`);
  }
}

/**
 * Mandar un brindis. `target`:
 * - "sala:<id>" → un chat de otra mesa con gente adentro: el aviso les aparece en el chat.
 * - "mesa:<sessionId>" → una mesa ocupada sin chat: el aviso va a SU MOZO, que les pregunta en persona
 *   (nadie recibe invitaciones de la nada en el celular).
 */
export async function sendBrindis(slug: string, code: string, target: string): Promise<Result> {
  const m = await memberContext(slug, code);
  if (!m) return { error: "Entrá al chat de tu mesa para mandar un brindis" };
  const { ctx, room } = m;
  if (room.linkedRoomIds.length) return { error: "Los brindis se mandan desde el chat de tu mesa" };

  let to: Awaited<ReturnType<typeof openRoom>> = null;
  let viaWaiter = false;
  let waiterId: string | null = null;
  if (target.startsWith("sala:")) {
    const r = await db.chatRoom.findFirst({ where: { id: target.slice(5), tenantId: ctx.tenant.id } });
    to = r ? await openRoom(ctx.tenant.id, r.code) : null;
    if (!to || to.linkedRoomIds.length) return { error: "Esa mesa ya no tiene el chat abierto" };
    viaWaiter = to.memberKeys.length === 0;
    if (viaWaiter && to.sessionId) {
      waiterId = (await db.tableSession.findUnique({ where: { id: to.sessionId }, select: { waiterId: true } }))?.waiterId ?? null;
    }
  } else if (target.startsWith("mesa:")) {
    const session = await db.tableSession.findFirst({
      where: { id: target.slice(5), tenantId: ctx.tenant.id, status: "OPEN" },
      include: { table: true },
    });
    if (!session) return { error: "Esa mesa ya no está ocupada" };
    if (session.id === room.sessionId) return { error: "Esa es tu mesa 😉" };
    // Se le arma el chat (vacío) a esa mesa; si aceptan, entran con el botón Chat de la carta o el QR del mozo.
    to =
      (await db.chatRoom.findFirst({ where: { sessionId: session.id, closedAt: null, linkedRoomIds: { isEmpty: true } } })) ??
      (await db.chatRoom.create({
        data: {
          tenantId: ctx.tenant.id,
          name: `Mesa ${await tableLabelOf(tenantDb(ctx.tenant.id), session.table)}`,
          code: newCode(),
          sessionId: session.id,
          tableLabel: await tableLabelOf(tenantDb(ctx.tenant.id), session.table),
        },
      }));
    viaWaiter = to.memberKeys.length === 0;
    waiterId = session.waiterId;
  }
  if (!to || to.id === room.id) return { error: "Elegí otra mesa" };

  const since = new Date(Date.now() - INVITE_TTL_MS);
  const [linked, between, rejected, mine, total] = await Promise.all([
    db.chatRoom.count({ where: { closedAt: null, linkedRoomIds: { hasEvery: [room.id, to.id] } } }),
    db.chatInvite.count({
      where: { status: "PENDING", createdAt: { gte: since }, OR: [{ fromRoomId: room.id, toRoomId: to.id }, { fromRoomId: to.id, toRoomId: room.id }] },
    }),
    db.chatInvite.count({ where: { fromRoomId: room.id, toRoomId: to.id, status: "REJECTED" } }),
    db.chatInvite.count({ where: { fromRoomId: room.id, status: "PENDING", createdAt: { gte: since } } }),
    db.chatInvite.count({ where: { fromRoomId: room.id } }),
  ]);
  if (linked) return { error: "Ya tienen un chat con esa mesa" };
  if (between) return { error: "Ya hay un brindis esperando respuesta con esa mesa" };
  // Si dijeron que no, esa noche no se les vuelve a insistir.
  if (rejected) return { error: "Esa mesa ya respondió. ¡Probá con otra!" };
  if (mine >= 3) return { error: "Tienen 3 brindis esperando respuesta. Esperá a que contesten." };
  // Tope por noche, para que nadie se ponga pesado con todo el salón.
  if (total >= MAX_BRINDIS) return { error: "Ya mandaron muchos brindis esta noche. ¡Disfruten la mesa! 🍻" };

  const invite = await db.chatInvite.create({ data: { tenantId: ctx.tenant.id, fromRoomId: room.id, toRoomId: to.id, viaWaiter } });
  if (viaWaiter) {
    await notifyStaff(ctx.tenant.id, {
      type: "brindis.mesa",
      inviteId: invite.id,
      fromLabel: label(room),
      toLabel: label(to),
      waiterId,
    });
    revalidatePath("/staff", "layout");
    revalidatePath("/admin", "layout");
  }
  await refreshRooms(slug, ctx.tenant.id, [room, to]);
  return {
    ok: viaWaiter
      ? `¡Listo! Le avisamos al mozo de la ${label(to)} para que les pregunte si se suman. 🍻`
      : `¡Brindis enviado a ${label(to)}! 🍻`,
  };
}

export async function answerBrindis(slug: string, code: string, inviteId: string, accept: boolean): Promise<Result & { jointCode?: string }> {
  const m = await memberContext(slug, code);
  if (!m) return { error: "Entrá al chat de tu mesa para responder" };
  const { ctx, room } = m;
  const invite = await db.chatInvite.findFirst({ where: { id: inviteId, toRoomId: room.id }, include: { fromRoom: true } });
  if (!invite || invite.status !== "PENDING" || Date.now() - invite.createdAt.getTime() > INVITE_TTL_MS) {
    return { error: "Ese brindis ya venció" };
  }
  const from = await openRoom(ctx.tenant.id, invite.fromRoom.code);
  if (!from) return { error: "La otra mesa ya cerró su chat" };

  if (!accept) {
    await db.chatInvite.update({ where: { id: invite.id }, data: { status: "REJECTED", respondedAt: new Date() } });
    await refreshRooms(slug, ctx.tenant.id, [room, from]);
    return { ok: "Listo, no se lo vamos a mostrar más." };
  }
  const joint = await db.chatRoom.create({
    data: { tenantId: ctx.tenant.id, name: `${label(from)} 🍻 ${label(room)}`, code: newCode(), linkedRoomIds: [from.id, room.id] },
  });
  await db.chatInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", respondedAt: new Date(), jointRoomId: joint.id } });
  await notifyStaff(ctx.tenant.id, { type: "muro" });
  await refreshRooms(slug, ctx.tenant.id, [room, from]);
  return { ok: "¡Brindis aceptado!", jointCode: joint.code };
}

/** Cualquiera de las dos mesas puede cortar el chat compartido (se borra). */
export async function closeJoint(slug: string, code: string): Promise<Result> {
  const ctx = await muroTenant(slug);
  const guest = await readGuest();
  if (!ctx || !guest) return { error: "No se pudo cerrar" };
  const joint = await db.chatRoom.findFirst({ where: { code, tenantId: ctx.tenant.id, closedAt: null } });
  if (!joint || !joint.linkedRoomIds.length) return { error: "Ese chat ya se cerró" };
  const sides = await db.chatRoom.findMany({ where: { id: { in: joint.linkedRoomIds } } });
  if (!sides.some((r) => r.memberKeys.includes(guest.key))) return { error: "Solo las mesas del chat lo pueden cerrar" };
  await db.$transaction([
    db.chatMessage.deleteMany({ where: { roomId: joint.id } }),
    db.chatRoom.update({ where: { id: joint.id }, data: { closedAt: new Date() } }),
  ]);
  await refreshRooms(slug, ctx.tenant.id, [joint, ...sides]);
  return { ok: "Chat cerrado" };
}

// ─────────────────────────────────────────────────────────────
// Foto de la mesa: selfie sacada en el momento, aprobada por la mesa
// ─────────────────────────────────────────────────────────────

/** Recibe la selfie ya achicada en el celular (JPEG como data URL, máx. ~150 KB). */
export async function uploadRoomPhoto(slug: string, code: string, dataUrl: string): Promise<Result> {
  const m = await memberContext(slug, code);
  if (!m) return { error: "Entrá al chat de tu mesa" };
  if (m.room.linkedRoomIds.length) return { error: "La foto se saca desde el chat de tu mesa" };
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 200_000) return { error: "La foto no es válida" };
  await db.chatRoom.update({ where: { id: m.room.id }, data: { photoData: dataUrl, photoBy: m.guest.key, photoApprovals: [] } });
  await notifyStaff(m.ctx.tenant.id, { type: "muro" });
  await refreshRooms(slug, m.ctx.tenant.id, [m.room]);
  const alone = m.room.memberKeys.every((k) => k === m.guest.key);
  return { ok: alone ? "¡Foto lista! Ya la ven las otras mesas." : "¡Foto lista! Ahora alguien más de la mesa la tiene que aprobar." };
}

/** Otra persona de la mesa aprueba (queda visible) o la rechaza (se borra). */
export async function voteRoomPhoto(slug: string, code: string, approve: boolean): Promise<Result> {
  const m = await memberContext(slug, code);
  if (!m || !m.room.photoData) return { error: "No hay foto para aprobar" };
  const { room, guest } = m;
  if (room.photoBy === guest.key) return { error: "La tiene que aprobar otra persona de la mesa" };
  await db.chatRoom.update({
    where: { id: room.id },
    data: approve
      ? { photoApprovals: [...new Set([...room.photoApprovals, guest.key])] }
      : { photoData: null, photoBy: null, photoApprovals: [] },
  });
  await refreshRooms(slug, m.ctx.tenant.id, [room]);
  return { ok: approve ? "¡Foto aprobada!" : "Foto descartada" };
}
