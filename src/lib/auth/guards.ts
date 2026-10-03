import "server-only";
import { forbidden, redirect } from "next/navigation";
import type { ModuleKey, Role } from "@/generated/prisma/enums";
import { getSession } from "@/lib/auth/session";
import { hasModule } from "@/lib/modules";
import { tenantDb } from "@/lib/tenant-db";

/** Exige sesión iniciada. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige admin de plataforma (equipo app-resto). */
export async function requirePlatformAdmin() {
  const session = await requireUser();
  if (!session.user.isPlatformAdmin) forbidden();
  return session;
}

/**
 * Exige sesión dentro de un tenant con alguno de los roles indicados.
 * Devuelve además `tdb`, el cliente Prisma acotado al tenant.
 */
export async function requireTenantRole(roles: Role[], module?: ModuleKey) {
  const session = await requireUser();
  const { membership, tenant } = session;
  if (!membership || !tenant) redirect("/login");
  if (!roles.includes(membership.role)) forbidden();
  if (module && !(await hasModule(tenant.id, module))) forbidden();

  return { ...session, membership, tenant, tdb: tenantDb(tenant.id) };
}
