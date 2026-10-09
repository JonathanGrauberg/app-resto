"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { checkbox, fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { canManageRoles, hasRole, rolesOf, sortRoles, STAFF_MANAGER_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import type { TenantDb } from "@/lib/tenant-db";

/** Roles que requieren email y contraseña (acceden al panel). Los operativos pueden ser solo PIN. */
const PASSWORD_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA"];

const pinField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^\d{4,6}$/.test(v), "El PIN tiene 4 a 6 dígitos");

const staffSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(40),
  roles: z.array(z.enum(Role)).min(1, "Elegí al menos un rol"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.email().safeParse(v).success, "Email no válido"),
  password: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || v.length >= 8, "Mínimo 8 caracteres"),
  pin: pinField,
  active: checkbox,
});

/** Un PIN no puede repetirse dentro del mismo local (identifica a la persona en dispositivos compartidos). */
async function pinInUse(tdb: TenantDb, pin: string, exceptId?: string) {
  const others = await tdb.membership.findMany({
    where: { pinHash: { not: null }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { pinHash: true },
  });
  for (const o of others) if (await verifySecret(pin, o.pinHash)) return true;
  return false;
}

export async function saveStaff(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant, membership: me } = await requireTenantRole(STAFF_MANAGER_ROLES);
  const parsed = staffSchema.safeParse({ ...Object.fromEntries(formData), roles: formData.getAll("roles") });
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  // El rol más importante es el principal (pantalla de inicio); el resto, adicionales.
  const [role, ...extraRoles] = sortRoles(d.roles);
  const next = { role, extraRoles };

  if (!canManageRoles(me, d.roles)) return { error: "Tu rol no puede asignar alguno de esos roles" };

  const current = id ? await tdb.membership.findUnique({ where: { id }, include: { user: true } }) : null;
  if (id && !current) return { error: "Usuario no encontrado" };
  if (current && !canManageRoles(me, rolesOf(current))) return { error: "Tu rol no puede editar a esta persona" };

  // Reglas de seguridad sobre uno mismo y el último dueño.
  const sameRoles = current && sortRoles(rolesOf(current)).join() === sortRoles(d.roles).join();
  if (current?.id === me.id && (!sameRoles || !d.active)) {
    return { error: "No podés cambiar tus propios roles ni desactivarte" };
  }
  if (current?.role === "OWNER" && (role !== "OWNER" || !d.active)) {
    const owners = await tdb.membership.count({ where: { role: "OWNER", active: true } });
    if (owners <= 1) return { error: "El local necesita al menos un dueño activo" };
  }

  const email = d.email ?? current?.user.email ?? null;
  const hasPassword = !!d.password || !!current?.user.passwordHash;
  const hasPin = !!d.pin || !!current?.pinHash;

  if (hasRole(next, PASSWORD_ROLES) && (!email || !hasPassword)) {
    return { error: "Este rol entra al panel: necesita email y contraseña", fieldErrors: { email: "Requerido para este rol" } };
  }
  if (!hasRole(next, PASSWORD_ROLES) && !hasPin && !(email && hasPassword)) {
    return { error: "Asigná un PIN para que pueda entrar", fieldErrors: { pin: "Requerido" } };
  }
  if (d.pin && (await pinInUse(tdb, d.pin, current?.id))) {
    return { error: "Ese PIN ya lo usa otra persona del local", fieldErrors: { pin: "PIN en uso" } };
  }
  if (d.email && d.email !== current?.user.email) {
    const taken = await db.user.findUnique({ where: { email: d.email } });
    if (taken) return { error: "Ese email ya tiene una cuenta", fieldErrors: { email: "Email en uso" } };
  }

  const passwordHash = d.password ? await hashSecret(d.password) : undefined;
  const pinHash = d.pin ? await hashSecret(d.pin) : undefined;

  if (current) {
    await db.$transaction([
      db.user.update({
        where: { id: current.userId },
        data: { name: d.name, email, ...(passwordHash ? { passwordHash } : {}) },
      }),
      db.membership.update({
        where: { id: current.id, tenantId: tenant.id },
        data: { role, extraRoles, active: d.active, ...(pinHash ? { pinHash } : {}) },
      }),
    ]);
    // Al desactivar, se cierran sus sesiones abiertas.
    if (!d.active) await db.authSession.deleteMany({ where: { membershipId: current.id } });
  } else {
    await db.user.create({
      data: {
        name: d.name,
        email,
        passwordHash: passwordHash ?? null,
        memberships: { create: { tenantId: tenant.id, role, extraRoles, pinHash: pinHash ?? null, active: d.active } },
      },
    });
  }

  revalidatePath("/admin/personal");
  if (!current) redirect(`/admin/personal?ok=${encodeURIComponent(`${d.name} fue dado de alta`)}`);
  return success("Cambios guardados");
}
