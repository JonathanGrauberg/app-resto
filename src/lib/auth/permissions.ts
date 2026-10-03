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
