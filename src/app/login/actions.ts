"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { staffHome } from "@/lib/auth/permissions";

export type LoginState = { error?: string } | undefined;

const credentials = z.object({
  email: z.email("Email no válido").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Ingresá la contraseña"),
  next: z.string().optional(),
});

/** Solo permite redirecciones internas. */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, next } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { active: true, tenant: { active: true } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user || !(await verifySecret(password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos" };
  }

  // MVP: se entra al primer local. Selector de local (cadenas) más adelante.
  const membership = user.memberships[0];
  if (!membership && !user.isPlatformAdmin) return { error: "Tu usuario no tiene acceso a ningún local" };

  await createSession({
    userId: user.id,
    tenantId: membership?.tenantId,
    membershipId: membership?.id,
    kind: "password",
  });

  redirect(safeNext(next) ?? (membership ? staffHome(membership.role) : "/platform"));
}

const pinSchema = z.object({
  slug: z.string(),
  membershipId: z.string().min(1, "Elegí tu usuario"),
  pin: z.string().regex(/^\d{4,6}$/, "El PIN tiene 4 a 6 dígitos"),
});

export async function loginWithPin(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = pinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { slug, membershipId, pin } = parsed.data;

  const membership = await db.membership.findFirst({
    where: { id: membershipId, active: true, tenant: { slug, active: true } },
  });
  if (!membership || !(await verifySecret(pin, membership.pinHash))) {
    return { error: "PIN incorrecto" };
  }

  await createSession({
    userId: membership.userId,
    tenantId: membership.tenantId,
    membershipId: membership.id,
    kind: "pin",
  });

  redirect(staffHome(membership.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
