import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "ar_session";

const DAY = 24 * 60 * 60 * 1000;
/** Email/contraseña: 30 días. PIN (dispositivos compartidos): 14 horas, un turno largo. */
const TTL = { password: 30 * DAY, pin: 14 * 60 * 60 * 1000 } as const;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(opts: {
  userId: string;
  tenantId?: string | null;
  membershipId?: string | null;
  kind: keyof typeof TTL;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL[opts.kind]);

  await db.authSession.create({
    data: {
      tokenHash: hashToken(token),
      userId: opts.userId,
      tenantId: opts.tenantId ?? null,
      membershipId: opts.membershipId ?? null,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Sesión actual con usuario, tenant y membresía. Cacheado por request. */
export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const membership = session.membershipId
    ? await db.membership.findFirst({
        where: { id: session.membershipId, active: true },
        include: { tenant: true },
      })
    : null;

  return {
    id: session.id,
    user: session.user,
    membership,
    tenant: membership?.tenant ?? null,
  };
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
