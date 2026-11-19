"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentDevice, forgetThisDevice, loginStaffAccount, lockMinutesLeft, registerPinFailure, registerPinSuccess, LOCK_MINUTES } from "@/lib/auth/devices";
import { verifySecret } from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { ADMIN_ROLES, hasRole, staffHome } from "@/lib/auth/permissions";
import { redeemProCode } from "@/lib/pro";

export type LoginState = { error?: string } | undefined;

const credentials = z.object({
  email: z.email("Email no válido").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Ingresá la contraseña"),
  next: z.string().optional(),
  /** Código PRO opcional: se activa apenas entra (solo dueño o admin del local). */
  code: z.string().trim().max(20).optional(),
});

/** Solo permite redirecciones internas. */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  // Sin "@": es la cuenta del personal del local (usuario + clave) → habilita este equipo y pide el PIN.
  const id = String(formData.get("email") ?? "").trim();
  if (id && !id.includes("@")) {
    const r = await loginStaffAccount(id, String(formData.get("password") ?? ""));
    if ("error" in r) return { error: r.error };
    redirect(`/login/pin/${r.slug}`);
  }

  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, next, code } = parsed.data;

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

  if (code && membership && hasRole(membership, ADMIN_ROLES)) {
    const r = await redeemProCode(membership.tenantId, code);
    redirect(`/admin/plan?pro=${r.ok ? "1" : "0"}`);
  }

  redirect(safeNext(next) ?? (membership ? staffHome(membership.role) : "/platform"));
}

const pinSchema = z.object({
  slug: z.string(),
  pin: z.string().regex(/^\d{4,6}$/, "El PIN tiene 4 a 6 dígitos"),
});

/** Solo el PIN: identifica a la persona dentro del local (los PIN no se repiten en un local). */
export async function loginWithPin(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = pinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { slug, pin } = parsed.data;

  const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true, active: true } });
  if (!tenant?.active) return { error: "PIN incorrecto" };

  // El PIN vale en equipos donde se entró con la cuenta del personal.
  const device = await currentDevice(tenant.id);
  if (!device) return { error: "Primero entrá con la cuenta del personal en este equipo." };

  const locked = await lockMinutesLeft(device.id);
  if (locked) return { error: `Demasiados intentos. Probá de nuevo en ${locked === 1 ? "1 minuto" : `${locked} minutos`}.` };

  const people = await db.membership.findMany({
    where: { tenantId: tenant.id, active: true, pinHash: { not: null } },
    select: { id: true, userId: true, role: true, pinHash: true },
  });
  let match: (typeof people)[number] | undefined;
  for (const m of people) {
    if (await verifySecret(pin, m.pinHash)) {
      match = m;
      break;
    }
  }
  if (!match) {
    const left = await registerPinFailure(device.id);
    if (left === 0) return { error: `Demasiados intentos: esperá ${LOCK_MINUTES} minutos.` };
    return { error: "PIN incorrecto" };
  }

  await registerPinSuccess(device.id);
  await destroySession();
  await createSession({
    userId: match.userId,
    tenantId: tenant.id,
    membershipId: match.id,
    deviceId: device.id,
    kind: "pin",
  });

  redirect(staffHome(match.role));
}

/** Salir: en un equipo del local vuelve a la pantalla del PIN (para que entre el siguiente). */
export async function logout() {
  const session = await getSession();
  await destroySession();
  const tenant = session?.tenant;
  if (tenant && (await currentDevice(tenant.id))) redirect(`/login/pin/${tenant.slug}`);
  redirect("/login");
}

/** "Salir de este local en este equipo": vuelve a pedir la cuenta del personal. */
export async function leaveVenue(slug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  await destroySession();
  if (tenant) await forgetThisDevice(tenant.id);
  redirect("/login");
}
