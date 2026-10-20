import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { findBlocked } from "@/lib/muro/filter";
import { hasModule } from "@/lib/modules";
import { regionOf, type CountryCode } from "@/lib/region";

export const newCode = (bytes = 6) => randomBytes(bytes).toString("base64url");

/** Se puede escribir desde 2 h antes del evento hasta 1 h después. La pantalla se ve siempre. */
export const wallOpen = (w: { startsAt: Date; endsAt: Date }, now = Date.now()) =>
  now >= w.startsAt.getTime() - 2 * 3_600_000 && now <= w.endsAt.getTime() + 3_600_000;

/** Un grupo suelto (sin mesa) se cierra solo a las 12 h. */
export const ROOM_TTL_MS = 12 * 3_600_000;

/** ¿El grupo ya no se puede usar? (cerrado, o suelto y con más de 12 h). */
export const roomGone = (r: { closedAt: Date | null; sessionId: string | null; createdAt: Date }, now = Date.now()) =>
  !!r.closedAt || (!r.sessionId && now - r.createdAt.getTime() > ROOM_TTL_MS);

/** Estado de un muro respecto de ahora. */
export const wallPhase = (w: { startsAt: Date; endsAt: Date }, now = Date.now()) =>
  now < w.startsAt.getTime() ? ("proximo" as const) : now <= w.endsAt.getTime() ? ("ahora" as const) : ("terminado" as const);

/** Local con el módulo Muro activo + su país y palabras propias (para el filtro). */
export async function muroTenant(slug: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: { settings: { select: { country: true, currency: true, locale: true, timezone: true, blockedWords: true, menuTheme: true } } },
  });
  if (!tenant || !tenant.active || !(await hasModule(tenant.id, "MURO"))) return null;
  return { tenant, region: regionOf(tenant.settings), blockedWords: tenant.settings?.blockedWords ?? [] };
}

export function checkText(text: string, country: CountryCode, extra: string[]) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 1) return { error: "Escribí algo" } as const;
  if (t.length > 140) return { error: "Máximo 140 caracteres" } as const;
  const bad = findBlocked(t, country, extra);
  if (bad) {
    return {
      error:
        bad === "datos de contacto"
          ? "No se pueden compartir teléfonos ni usuarios de redes."
          : "Ese mensaje tiene palabras que no están permitidas. Revisá las reglas.",
    } as const;
  }
  return { text: t } as const;
}

/** Antispam: como mucho 1 mensaje cada 5 s y 8 por minuto por persona. */
export function tooFast(recent: Date[], now = Date.now()) {
  if (recent.some((d) => now - d.getTime() < 5_000)) return "Esperá unos segundos antes de mandar otro.";
  if (recent.filter((d) => now - d.getTime() < 60_000).length >= 8) return "Mandaste muchos mensajes seguidos. Esperá un minuto.";
  return null;
}

type Room = {
  id: string;
  name: string;
  tableLabel: string | null;
  linkedRoomIds: string[];
  memberKeys: string[];
  blockedKeys: string[];
  photoData: string | null;
  photoBy: string | null;
  photoApprovals: string[];
  closedAt: Date | null;
  sessionId: string | null;
  createdAt: Date;
  tenantId: string;
};

const roomLabel = (r: { tableLabel: string | null; name: string }) => (r.tableLabel ? `Mesa ${r.tableLabel}` : r.name);
/** La foto se muestra a otras mesas solo si otra persona de la mesa la aprobó. */
const approvedPhoto = (r: Room) => (r.photoData && r.photoApprovals.length > 0 ? r.photoData : null);

/**
 * Todo lo que ve una persona en el chat de su mesa: la registra como participante,
 * y arma brindis recibidos/enviados, chats compartidos, mesas a las que se puede invitar y la foto.
 */
export async function chatPageData(room: Room, guestKey: string) {
  if (!room.memberKeys.includes(guestKey) && !room.blockedKeys.includes(guestKey)) {
    await db.chatRoom.update({ where: { id: room.id }, data: { memberKeys: [...room.memberKeys, guestKey] } });
    room = { ...room, memberKeys: [...room.memberKeys, guestKey] };
  }
  const now = Date.now();
  const since = new Date(now - 15 * 60_000);
  const isJoint = room.linkedRoomIds.length > 0;

  if (isJoint) {
    const sides = await db.chatRoom.findMany({ where: { id: { in: room.linkedRoomIds } } });
    return {
      isJoint,
      members: room.memberKeys.length,
      sides: sides.map((r) => ({ label: roomLabel(r), photo: approvedPhoto(r) })),
      incoming: [],
      outgoing: [],
      joints: [],
      candidates: [],
      photo: null,
    };
  }

  const [incoming, outgoing, answered, joints, others] = await Promise.all([
    db.chatInvite.findMany({ where: { toRoomId: room.id, status: "PENDING", createdAt: { gte: since } }, include: { fromRoom: true }, orderBy: { createdAt: "asc" } }),
    db.chatInvite.findMany({ where: { fromRoomId: room.id, status: "PENDING", createdAt: { gte: since } }, include: { toRoom: true } }),
    db.chatInvite.findMany({ where: { fromRoomId: room.id, status: "REJECTED" }, select: { toRoomId: true } }),
    db.chatRoom.findMany({ where: { closedAt: null, linkedRoomIds: { has: room.id } }, orderBy: { createdAt: "desc" } }),
    db.chatRoom.findMany({ where: { tenantId: room.tenantId, closedAt: null, linkedRoomIds: { isEmpty: true }, id: { not: room.id } } }),
  ]);
  const liveJoints = joints.filter((j) => !roomGone(j, now));
  const busy = new Set([
    ...liveJoints.flatMap((j) => j.linkedRoomIds),
    ...outgoing.map((i) => i.toRoomId),
    ...incoming.map((i) => i.fromRoomId),
    ...answered.map((i) => i.toRoomId),
  ]);

  return {
    isJoint,
    members: room.memberKeys.length,
    sides: [],
    incoming: incoming
      .filter((i) => !roomGone(i.fromRoom, now))
      .map((i) => ({ id: i.id, label: roomLabel(i.fromRoom), photo: approvedPhoto(i.fromRoom), people: i.fromRoom.memberKeys.length })),
    outgoing: outgoing.map((i) => ({ id: i.id, label: roomLabel(i.toRoom) })),
    joints: liveJoints.map((j) => ({ code: j.code, name: j.name })),
    candidates: others
      .filter((r) => !roomGone(r, now) && !busy.has(r.id) && r.memberKeys.length > 0)
      .map((r) => ({ id: r.id, label: roomLabel(r), photo: approvedPhoto(r), people: r.memberKeys.length }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })),
    photo: room.photoData
      ? {
          data: room.photoData,
          approved: room.photoApprovals.length > 0,
          mine: room.photoBy === guestKey,
          voted: room.photoApprovals.includes(guestKey),
        }
      : null,
  };
}

export type ChatPageData = Awaited<ReturnType<typeof chatPageData>>;
