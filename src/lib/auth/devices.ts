import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { db } from "@/lib/db";

/**
 * Equipos vinculados para entrar con PIN.
 * El código del local es público (está en la URL de la carta), así que el PIN solo sirve
 * desde un equipo autorizado: equipo + PIN. Cada equipo guarda un token en una cookie por local.
 * Un equipo se autoriza con el QR que muestra el admin, o entrando una vez con el usuario
 * del local (su código) y la clave del local.
 */

const COOKIE_PREFIX = "yd_";
/** Cuánto dura el QR para vincular un equipo. */
export const PAIRING_MINUTES = 10;
/** PIN incorrectos seguidos antes de bloquear a esa persona en ese equipo. */
export const MAX_PIN_FAILURES = 5;
export const LOCK_MINUTES = 10;
/** Claves del local incorrectas desde una misma IP antes de bloquear. */
export const MAX_STAFF_PASSWORD_FAILURES = 10;
export const STAFF_PASSWORD_LOCK_MINUTES = 15;
export const STAFF_PASSWORD_MIN = 6;

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

// ─────────────────────────────────────────────────────────────
// Clave del local
// ─────────────────────────────────────────────────────────────

async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hash(ip);
}

/** Guarda (o cambia) la clave del local. Con `unpairAll`, desvincula todos los equipos (ej. se fue alguien). */
export async function setStaffPassword(tenantId: string, password: string, unpairAll: boolean) {
  const staffPasswordHash = await hashSecret(password);
  await db.tenantSettings.update({ where: { tenantId }, data: { staffPasswordHash } });
  if (unpairAll) {
    const devices = await db.staffDevice.findMany({ where: { tenantId, revokedAt: null }, select: { id: true } });
    for (const d of devices) await revokeDevice(tenantId, d.id);
  }
  await db.staffLoginLock.deleteMany({ where: { tenantId } });
}

export async function clearStaffPassword(tenantId: string) {
  await db.tenantSettings.update({ where: { tenantId }, data: { staffPasswordHash: null } });
}

/**
 * Usuario del local + clave del local: si son correctos, vincula este equipo.
 * Mensajes genéricos para no revelar qué locales existen; bloqueo por IP ante muchos intentos.
 */
export async function pairWithStaffPassword(slug: string, password: string, name: string) {
  const generic = { error: "Usuario o clave del local incorrectos" } as const;
  const tenant = await db.tenant.findUnique({
    where: { slug: slug.trim().toLowerCase() },
    select: { id: true, slug: true, active: true, settings: { select: { staffPasswordHash: true } } },
  });
  if (!tenant || !tenant.active) return generic;

  const ipHash = await clientIpHash();
  const key = { tenantId_ipHash: { tenantId: tenant.id, ipHash } };
  const lock = await db.staffLoginLock.findUnique({ where: key });
  const left = lock?.lockedUntil ? lock.lockedUntil.getTime() - Date.now() : 0;
  if (left > 0) {
    const m = Math.ceil(left / MINUTE);
    return { error: `Demasiados intentos. Probá de nuevo en ${m === 1 ? "1 minuto" : `${m} minutos`}.` } as const;
  }

  const stored = tenant.settings?.staffPasswordHash;
  if (!stored) return { error: "Este local todavía no tiene clave del personal. El encargado la crea en Personal → Equipos." } as const;

  if (!(await verifySecret(password, stored))) {
    const l = await db.staffLoginLock.upsert({
      where: key,
      create: { tenantId: tenant.id, ipHash, failures: 1 },
      update: { failures: { increment: 1 } },
    });
    if (l.failures >= MAX_STAFF_PASSWORD_FAILURES) {
      await db.staffLoginLock.update({
        where: key,
        data: { failures: 0, lockedUntil: new Date(Date.now() + STAFF_PASSWORD_LOCK_MINUTES * MINUTE) },
      });
      return { error: `Demasiados intentos: probá de nuevo en ${STAFF_PASSWORD_LOCK_MINUTES} minutos.` } as const;
    }
    return generic;
  }

  await db.staffLoginLock.deleteMany({ where: { tenantId: tenant.id, ipHash } });
  // Si este navegador ya estaba vinculado, se reutiliza ese equipo.
  if (!(await currentDevice(tenant.id))) await createDevice(tenant.id, name);
  return { slug: tenant.slug } as const;
}
