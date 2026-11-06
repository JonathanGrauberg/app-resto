import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Equipos vinculados para entrar con PIN.
 * El código del local es público (está en la URL de la carta), así que el PIN solo sirve
 * desde un equipo que el admin autorizó: equipo + PIN. Cada equipo guarda un token en una cookie por local.
 */

const COOKIE_PREFIX = "yd_";
/** Cuánto dura el QR para vincular un equipo. */
export const PAIRING_MINUTES = 10;
/** PIN incorrectos seguidos antes de bloquear a esa persona en ese equipo. */
export const MAX_PIN_FAILURES = 5;
export const LOCK_MINUTES = 10;

const MINUTE = 60_000;
/** Los navegadores limitan las cookies a ~400 días. */
const COOKIE_DAYS = 395;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const cookieName = (tenantId: string) => `${COOKIE_PREFIX}${tenantId}`;

async function setDeviceCookie(tenantId: string, token: string) {
  const jar = await cookies();
  jar.set(cookieName(tenantId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
}

async function createDevice(tenantId: string, name: string) {
  const token = newToken();
  const device = await db.staffDevice.create({ data: { tenantId, name, tokenHash: hash(token) } });
  await setDeviceCookie(tenantId, token);
  return device;
}

/** Nuevo QR de vinculación (un solo uso). Devuelve el token para armar la URL. */
export async function createPairing(tenantId: string) {
  const token = newToken();
  await db.devicePairing.create({
    data: { tenantId, tokenHash: hash(token), expiresAt: new Date(Date.now() + PAIRING_MINUTES * MINUTE) },
  });
  return token;
}

/** Vinculación vigente (sin usar y sin vencer), con su local. */
export async function findPairing(token: string) {
  const p = await db.devicePairing.findUnique({
    where: { tokenHash: hash(token) },
    include: { tenant: { select: { id: true, slug: true, name: true, active: true } } },
  });
  if (!p || p.usedAt || p.expiresAt < new Date() || !p.tenant.active) return null;
  return p;
}

/** Usa el QR: lo marca usado (solo una vez, aunque se escanee dos veces a la par) y vincula este equipo. */
export async function redeemPairing(token: string, name: string) {
  const p = await findPairing(token);
  if (!p) return null;
  const { count } = await db.devicePairing.updateMany({
    where: { id: p.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count !== 1) return null;
  await createDevice(p.tenantId, name);
  return p.tenant;
}

/** El admin vincula el equipo desde el que está usando el panel. */
export async function pairThisDevice(tenantId: string, name: string) {
  return createDevice(tenantId, name);
}

/** Equipo vinculado de este navegador para ese local (o null). */
export async function currentDevice(tenantId: string) {
  const token = (await cookies()).get(cookieName(tenantId))?.value;
  if (!token) return null;
  return db.staffDevice.findFirst({ where: { tokenHash: hash(token), tenantId, revokedAt: null } });
}

/** Locales en los que este navegador está vinculado (normalmente uno). */
export async function pairedTenants() {
  const tokens = (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith(COOKIE_PREFIX))
    .map((c) => hash(c.value));
  if (!tokens.length) return [];
  const devices = await db.staffDevice.findMany({
    where: { tokenHash: { in: tokens }, revokedAt: null, tenant: { active: true } },
    include: { tenant: { select: { slug: true, name: true } } },
  });
  return devices.map((d) => ({ slug: d.tenant.slug, name: d.tenant.name }));
}

/** Quita un equipo: ya no puede entrar con PIN y se cierran las sesiones abiertas desde él. */
export async function revokeDevice(tenantId: string, deviceId: string) {
  const { count } = await db.staffDevice.updateMany({
    where: { id: deviceId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count) await db.authSession.deleteMany({ where: { deviceId } });
  return count > 0;
}

/** Si esta persona está bloqueada en este equipo, minutos que faltan. */
export async function lockMinutesLeft(deviceId: string, membershipId: string) {
  const lock = await db.pinLock.findUnique({ where: { deviceId_membershipId: { deviceId, membershipId } } });
  const left = lock?.lockedUntil ? lock.lockedUntil.getTime() - Date.now() : 0;
  return left > 0 ? Math.ceil(left / MINUTE) : 0;
}

/** Anota un PIN incorrecto. Devuelve cuántos intentos quedan (0 = recién bloqueado). */
export async function registerPinFailure(deviceId: string, membershipId: string) {
  const lock = await db.pinLock.upsert({
    where: { deviceId_membershipId: { deviceId, membershipId } },
    create: { deviceId, membershipId, failures: 1 },
    update: { failures: { increment: 1 } },
  });
  if (lock.failures < MAX_PIN_FAILURES) return MAX_PIN_FAILURES - lock.failures;
  const now = new Date();
  await db.pinLock.update({
    where: { deviceId_membershipId: { deviceId, membershipId } },
    data: { failures: 0, lockedAt: now, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * MINUTE) },
  });
  return 0;
}

/** PIN correcto: limpia los intentos y anota el uso del equipo. */
export async function registerPinSuccess(deviceId: string, membershipId: string) {
  await Promise.all([
    db.pinLock.updateMany({ where: { deviceId, membershipId }, data: { failures: 0, lockedUntil: null } }),
    db.staffDevice.update({ where: { id: deviceId }, data: { lastUsedAt: new Date() } }),
  ]);
}

/** Equipos activos del local, con los bloqueos por PIN de las últimas 24 h (para avisarle al admin). */
export async function devicesOf(tenantId: string) {
  const since = new Date(Date.now() - 24 * 60 * MINUTE);
  return db.staffDevice.findMany({
    where: { tenantId, revokedAt: null },
    include: { pinLocks: { where: { lockedAt: { gt: since } }, orderBy: { lockedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
}
