import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Quien escribe en el Muro o en un chat: sin cuenta. Una cookie firmada guarda un id propio,
 * el apodo y que confirmó ser mayor de 18 y aceptó las reglas. Vale 12 horas (una noche).
 */
export type Guest = { key: string; name: string; adultAt: string };

const COOKIE = "ar_muro";
const MAX_AGE = 12 * 60 * 60;

function sign(payload: string) {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET no configurado");
  return createHmac("sha256", s).update(`muro:${payload}`).digest("base64url");
}

export async function readGuest(): Promise<Guest | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Guest;
  } catch {
    return null;
  }
}

/** Confirma +18 y reglas, con el apodo elegido. Conserva el id si ya tenía uno (así un bloqueo sigue valiendo). */
export async function saveGuest(name: string) {
  const prev = await readGuest();
  const g: Guest = { key: prev?.key ?? randomBytes(9).toString("base64url"), name, adultAt: new Date().toISOString() };
  const payload = Buffer.from(JSON.stringify(g)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return g;
}
