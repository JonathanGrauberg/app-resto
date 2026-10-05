import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Identidad del comensal: sin cuenta ni registro. Al unirse a una mesa recibe una cookie
 * firmada (HMAC) con la sesión de mesa, un id propio y su apodo. Al cobrarse la mesa,
 * la sesión se cierra y la cookie deja de valer.
 */

export type Diner = { sessionId: string; dinerId: string; nickname: string; tenantId: string };

const COOKIE = "ar_diner";
const MAX_AGE = 12 * 60 * 60; // una comida larga; después hay que volver a escanear

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET no configurado");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function newDinerId() {
  return randomBytes(9).toString("base64url");
}

export async function setDinerCookie(d: Diner) {
  const payload = Buffer.from(JSON.stringify(d)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Comensal de la cookie, solo si pertenece a este local. No valida que la sesión siga abierta. */
export async function readDiner(tenantId: string): Promise<Diner | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString()) as Diner;
    return d.tenantId === tenantId ? d : null;
  } catch {
    return null;
  }
}

/** Apodo por defecto si el comensal no escribe uno. */
export function defaultNickname(existing: number) {
  return `Comensal ${existing + 1}`;
}
