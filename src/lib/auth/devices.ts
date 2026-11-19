import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { db } from "@/lib/db";

/**
 * Equipos del local para entrar con PIN.
 * Un equipo queda habilitado cuando alguien entra en él con la cuenta del personal (usuario y clave que crea el dueño).
 * Desde ahí, cada persona entra con su PIN: el PIN solo dice quién es, la cuenta del personal es la llave.
 * Cada equipo guarda un token en una cookie por local.
 */

const COOKIE_PREFIX = "yd_";
/** PIN incorrectos seguidos en un equipo antes de frenarlo un rato. */
export const MAX_PIN_FAILURES = 10;
export const LOCK_MINUTES = 2;
/** El PIN se escribe solo (sin elegir persona): los intentos se cuentan por equipo. */
const ANY = "*";

const MINUTE = 60_000;
/** Los navegadores limitan las cookies a ~400 días. */
const COOKIE_DAYS = 395;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const cookieName = (tenantId: string) => `${COOKIE_PREFIX}${tenantId}`;

/** Nombre automático del equipo a partir del navegador (ej. "Chrome en Windows"). */
async function deviceName() {
  const ua = (await headers()).get("user-agent") ?? "";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [browser, os].filter(Boolean).join(" en ") || "Equipo";
}

/** Equipo de este navegador para ese local (o null). */
export async function currentDevice(tenantId: string) {
  const token = (await cookies()).get(cookieName(tenantId))?.value;
  if (!token) return null;
  return db.staffDevice.findFirst({ where: { tokenHash: hash(token), tenantId, revokedAt: null } });
}

/** Al entrar con la cuenta del personal: deja este equipo habilitado para PIN (si no lo estaba). */
export async function ensureDevice(tenantId: string) {
  const existing = await currentDevice(tenantId);
  if (existing) return existing;
  const token = newToken();
  const device = await db.staffDevice.create({ data: { tenantId, name: await deviceName(), tokenHash: hash(token) } });
  (await cookies()).set(cookieName(tenantId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
  return device;
}

/** Locales habilitados en este navegador (normalmente uno). */
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

/** "Salir del local en este equipo": lo deshabilita y borra su cookie (vuelve a pedir usuario y clave). */
export async function forgetThisDevice(tenantId: string) {
  const device = await currentDevice(tenantId);
  if (device) await revokeDevice(tenantId, device.id);
  (await cookies()).delete(cookieName(tenantId));
}

/** Si este equipo está frenado por PIN incorrectos, minutos que faltan. */
export async function lockMinutesLeft(deviceId: string) {
  const lock = await db.pinLock.findUnique({ where: { deviceId_membershipId: { deviceId, membershipId: ANY } } });
  const left = lock?.lockedUntil ? lock.lockedUntil.getTime() - Date.now() : 0;
  return left > 0 ? Math.ceil(left / MINUTE) : 0;
}

/** Anota un PIN incorrecto. Devuelve cuántos intentos quedan (0 = recién frenado). */
export async function registerPinFailure(deviceId: string) {
  const key = { deviceId_membershipId: { deviceId, membershipId: ANY } };
  const lock = await db.pinLock.upsert({
    where: key,
    create: { deviceId, membershipId: ANY, failures: 1 },
    update: { failures: { increment: 1 } },
  });
  if (lock.failures < MAX_PIN_FAILURES) return MAX_PIN_FAILURES - lock.failures;
  const now = new Date();
  await db.pinLock.update({
    where: key,
    data: { failures: 0, lockedAt: now, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * MINUTE) },
  });
  return 0;
}

/** PIN correcto: limpia los intentos y anota el uso del equipo. */
export async function registerPinSuccess(deviceId: string) {
  await Promise.all([
    db.pinLock.updateMany({ where: { deviceId, membershipId: ANY }, data: { failures: 0, lockedUntil: null } }),
    db.staffDevice.update({ where: { id: deviceId }, data: { lastUsedAt: new Date() } }),
  ]);
}

/** Equipos activos del local, con los frenos por PIN de las últimas 24 h (para avisarle al admin). */
export async function devicesOf(tenantId: string) {
  const since = new Date(Date.now() - 24 * 60 * MINUTE);
  return db.staffDevice.findMany({
    where: { tenantId, revokedAt: null },
    include: { pinLocks: { where: { lockedAt: { gt: since } }, orderBy: { lockedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────
// Cuenta del personal (usuario + clave que crea el dueño)
// ─────────────────────────────────────────────────────────────

export const STAFF_PASSWORD_MIN = 6;
const MAX_STAFF_FAILURES = 10;
const STAFF_LOCK_MINUTES = 15;

/** Usuario de la cuenta del personal: minúsculas, números, punto, guion. Sin "@" (eso es un email). */
export const STAFF_USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const normalizeUsername = (v: string) => v.trim().toLowerCase();

async function clientIpHash() {
  const h = await headers();
  return hash(h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown");
}

/**
 * Entrar con la cuenta del personal: si usuario y clave son correctos, habilita este equipo
 * y devuelve el local (después se pide el PIN). Frena 15 min a los 10 intentos fallidos desde la misma IP.
 */
export async function loginStaffAccount(username: string, password: string) {
  const wrong = { error: "Usuario o contraseña incorrectos" } as const;
  const settings = await db.tenantSettings.findUnique({
    where: { staffUsername: normalizeUsername(username) },
    select: { tenantId: true, staffPasswordHash: true, tenant: { select: { slug: true, active: true } } },
  });
  if (!settings?.tenant.active || !settings.staffPasswordHash) return wrong;

  const id = { tenantId: settings.tenantId, ipHash: await clientIpHash() };
  const key = { tenantId_ipHash: id };
  const lock = await db.staffLoginLock.findUnique({ where: key });
  const left = lock?.lockedUntil ? lock.lockedUntil.getTime() - Date.now() : 0;
  if (left > 0) {
    const m = Math.ceil(left / MINUTE);
    return { error: `Demasiados intentos. Probá de nuevo en ${m === 1 ? "1 minuto" : `${m} minutos`}.` } as const;
  }

  if (!(await verifySecret(password, settings.staffPasswordHash))) {
    const l = await db.staffLoginLock.upsert({ where: key, create: { ...id, failures: 1 }, update: { failures: { increment: 1 } } });
    if (l.failures >= MAX_STAFF_FAILURES) {
      await db.staffLoginLock.update({ where: key, data: { failures: 0, lockedUntil: new Date(Date.now() + STAFF_LOCK_MINUTES * MINUTE) } });
      return { error: `Demasiados intentos: probá de nuevo en ${STAFF_LOCK_MINUTES} minutos.` } as const;
    }
    return wrong;
  }

  await db.staffLoginLock.deleteMany({ where: id });
  await ensureDevice(settings.tenantId);
  return { slug: settings.tenant.slug } as const;
}

/** Crea o cambia la cuenta del personal. Con `unpairAll`, todos los equipos vuelven a pedir usuario y clave. */
export async function saveStaffAccount(tenantId: string, username: string, password: string | null, unpairAll: boolean) {
  const staffUsername = normalizeUsername(username);
  const taken = await db.tenantSettings.findFirst({ where: { staffUsername, tenantId: { not: tenantId } }, select: { tenantId: true } });
  if (taken) return { error: "Ese usuario ya lo usa otro local. Probá con otro (ej. personal.gunda)." } as const;
  await db.tenantSettings.update({
    where: { tenantId },
    data: { staffUsername, ...(password ? { staffPasswordHash: await hashSecret(password) } : {}) },
  });
  if (unpairAll) {
    const devices = await db.staffDevice.findMany({ where: { tenantId, revokedAt: null }, select: { id: true } });
    for (const d of devices) await revokeDevice(tenantId, d.id);
  }
  await db.staffLoginLock.deleteMany({ where: { tenantId } });
  return { ok: true } as const;
}
