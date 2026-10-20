"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readGuest, saveGuest } from "@/lib/muro/guest";
import { ROOM_TTL_MS, checkText, muroTenant, tooFast, wallOpen } from "@/lib/muro/data";
import { findBlocked } from "@/lib/muro/filter";
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
      db.chatRoom.update({ where: { id: room.id }, data: { closedAt: new Date() } }),
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
