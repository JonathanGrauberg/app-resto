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
