import type { Role } from "@/generated/prisma/enums";

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  CAJA: "Caja",
  MOZO: "Mozo",
  COCINA: "Cocina",
  BAR: "Bar",
};

/** Roles con acceso al panel de administración del tenant. */
export const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"];

/** Roles operativos (PWA del personal). Owner/Admin también pueden entrar. */
export const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA", "MOZO", "COCINA", "BAR"];

/** Caja es superusuario operativo: puede hacer todo lo del mozo + cobrar + CRUD de mozos. */
export const CAN_MANAGE_TABLES: Role[] = ["OWNER", "ADMIN", "CAJA", "MOZO"];

/** Pueden gestionar personal. Caja solo gestiona mozos (ver canManageRole). */
export const STAFF_MANAGER_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA"];

/** Orden de importancia: el primero marcado es el rol principal (pantalla de inicio). */
export const ROLE_ORDER: Role[] = ["OWNER", "ADMIN", "CAJA", "MOZO", "COCINA", "BAR"];

/** Algo con rol principal y roles adicionales (una membresía). */
export type WithRoles = { role: Role; extraRoles?: Role[] | null };

/** Todos los roles de una persona en el local. */
export function rolesOf(m: WithRoles): Role[] {
  return [...new Set([m.role, ...(m.extraRoles ?? [])])];
}

/** ¿Tiene alguno de estos roles? */
export function hasRole(m: WithRoles, allowed: Role[]) {
  return rolesOf(m).some((r) => allowed.includes(r));
}

/** Nombre de los roles para mostrar: "Caja · Mozo". */
export function rolesLabel(m: WithRoles) {
  return sortRoles(rolesOf(m))
    .map((r) => ROLE_LABEL[r])
    .join(" · ");
}

export function sortRoles(roles: Role[]) {
  return [...new Set(roles)].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

/** ¿Alguno de los roles de `actor` puede gestionar todos los roles de `target`? */
export function canManageRoles(actor: WithRoles, target: Role[]) {
  const mine = rolesOf(actor);
  return target.every((t) => mine.some((a) => canManageRole(a, t)));
}

/** ¿Puede `actor` crear/editar a alguien con rol `target`? */
export function canManageRole(actor: Role, target: Role) {
  switch (actor) {
    case "OWNER":
      return true;
    case "ADMIN":
      return target !== "OWNER";
    case "CAJA":
      return target === "MOZO";
    default:
      return false;
  }
}

/** Pantalla de inicio del personal según su rol. */
export function staffHome(role: Role) {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "/admin";
    case "CAJA":
      return "/staff/caja";
    case "MOZO":
      return "/staff/mozo";
    case "COCINA":
      return "/staff/cocina";
    case "BAR":
      return "/staff/bar";
  }
}
