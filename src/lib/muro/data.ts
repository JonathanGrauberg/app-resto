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
  code: string;
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
/**
 * La foto vale si otra persona de la mesa la aprobó, o si quien la sacó está solo en el chat
 * (no hay a quién pedirle). Si después se suma alguien, a esa persona se le pide aprobarla.
 */
export const photoOk = (r: Pick<Room, "photoData" | "photoApprovals" | "memberKeys" | "photoBy">) =>
  !!r.photoData && (r.photoApprovals.length > 0 || r.memberKeys.every((k) => k === r.photoBy));
const approvedPhoto = (r: Room) => (photoOk(r) ? r.photoData : null);

/**
 * Pestañas de arriba: el chat de la mesa y uno por cada brindis aceptado ("🍻 Mesa 7").
 * Se ven igual desde cualquiera de las dos mesas.
 */
async function chatTabs(own: Room, activeId: string, now: number) {
  const joints = (await db.chatRoom.findMany({ where: { closedAt: null, linkedRoomIds: { has: own.id } }, orderBy: { createdAt: "asc" } })).filter(
    (j) => !roomGone(j, now),
  );
  const otherIds = joints.flatMap((j) => j.linkedRoomIds).filter((id) => id !== own.id);
  const others = otherIds.length ? await db.chatRoom.findMany({ where: { id: { in: otherIds } } }) : [];
  return [
    { code: own.code, label: own.name, kind: "mesa" as const, active: own.id === activeId, photo: approvedPhoto(own) },
    ...joints.map((j) => {
      const other = others.find((o) => o.id !== own.id && j.linkedRoomIds.includes(o.id));
      return { code: j.code, label: other ? roomLabel(other) : j.name, kind: "brindis" as const, active: j.id === activeId, photo: other ? approvedPhoto(other) : null };
    }),
  ];
}

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
  const since = new Date(now - 30 * 60_000);
  const isJoint = room.linkedRoomIds.length > 0;

  if (isJoint) {
    const sides = await db.chatRoom.findMany({ where: { id: { in: room.linkedRoomIds } } });
    // Su mesa es el lado donde participa (para armar las mismas pestañas que ve en su chat).
    const own = sides.find((r) => r.memberKeys.includes(guestKey)) ?? sides[0];
    const other = sides.find((r) => r.id !== own?.id);
    return {
      isJoint,
      /** Visto desde cada mesa: "Chat con Mesa 7". */
      title: other ? `Chat con ${roomLabel(other)}` : room.name,
      tabs: own ? await chatTabs(own, room.id, now) : [],
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
  // Mesas ocupadas sin chat (o con el chat vacío): el brindis va a su mozo.
  const occupied = await db.tableSession.findMany({
    where: { tenantId: room.tenantId, status: "OPEN", ...(room.sessionId ? { id: { not: room.sessionId } } : {}) },
    include: { table: { select: { number: true, groupId: true } } },
  });
  const liveJoints = joints.filter((j) => !roomGone(j, now));
  const busy = new Set([
    ...liveJoints.flatMap((j) => j.linkedRoomIds),
    ...outgoing.map((i) => i.toRoomId),
    ...incoming.map((i) => i.fromRoomId),
    ...answered.map((i) => i.toRoomId),
  ]);

  return {
    isJoint,
    title: room.name,
    tabs: liveJoints.length ? await chatTabs(room, room.id, now) : [],
    members: room.memberKeys.length,
    sides: [],
    incoming: incoming
      .filter((i) => !roomGone(i.fromRoom, now))
      .map((i) => ({ id: i.id, label: roomLabel(i.fromRoom), photo: approvedPhoto(i.fromRoom), people: i.fromRoom.memberKeys.length })),
    outgoing: outgoing.map((i) => ({ id: i.id, label: roomLabel(i.toRoom) })),
    joints: liveJoints.map((j) => ({ code: j.code, name: j.name })),
    candidates: [
      // Con gente en el chat: el aviso les aparece directo.
      ...others
        .filter((r) => !roomGone(r, now) && !busy.has(r.id) && r.memberKeys.length > 0)
        .map((r) => ({ id: `sala:${r.id}`, label: roomLabel(r), photo: approvedPhoto(r), people: r.memberKeys.length, viaWaiter: false })),
      // Sin chat abierto: le avisamos al mozo, que les pregunta.
      ...occupied
        .filter((s) => {
          const r = others.find((o) => o.sessionId === s.id && !roomGone(o, now));
          return !r || (r.memberKeys.length === 0 && !busy.has(r.id));
        })
        .map((s) => ({ id: `mesa:${s.id}`, label: `Mesa ${s.table.number}`, photo: null, people: s.guests, viaWaiter: true })),
    ].sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })),
    photo: room.photoData
      ? {
          data: room.photoData,
          approved: photoOk(room),
          mine: room.photoBy === guestKey,
          voted: room.photoApprovals.includes(guestKey),
        }
      : null,
  };
}

export type ChatPageData = Awaited<ReturnType<typeof chatPageData>>;
