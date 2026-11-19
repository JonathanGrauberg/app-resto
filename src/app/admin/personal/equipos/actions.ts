"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkbox, fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { clearStaffPassword, createPairing, pairThisDevice, revokeDevice, setStaffPassword, STAFF_PASSWORD_MIN } from "@/lib/auth/devices";
import { ADMIN_ROLES } from "@/lib/auth/permissions";

const PATH = "/admin/personal/equipos";

/** Nuevo QR de vinculación (un solo uso, vence a los pocos minutos). */
export async function newPairing() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const token = await createPairing(tenant.id);
  return { path: `/login/vincular/${token}` };
}

/** Vincula el equipo desde el que el admin está usando el panel (ej. la tablet de la caja). */
export async function pairHere(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const name = z.string().trim().min(2, "Poné un nombre para el equipo").max(40).safeParse(formData.get("name") ?? "");
  if (!name.success) return fail(name.error.issues[0]?.message ?? "Nombre no válido");
  await pairThisDevice(tenant.id, name.data);
  revalidatePath(PATH);
  return success("Listo: este equipo ya puede entrar con PIN.");
}

export async function removeDevice(deviceId: string) {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  await revokeDevice(tenant.id, deviceId);
  revalidatePath(PATH);
}

const staffPasswordSchema = z.object({
  password: z.string().min(STAFF_PASSWORD_MIN, `Mínimo ${STAFF_PASSWORD_MIN} caracteres`).max(100),
  unpairAll: checkbox,
});

/** Crea o cambia la clave del local (usuario del local + esta clave → el equipo queda listo para PIN). */
export async function saveStaffPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const parsed = staffPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  await setStaffPassword(tenant.id, parsed.data.password, parsed.data.unpairAll);
  revalidatePath(PATH);
  return success(parsed.data.unpairAll ? "Clave guardada. Se desvincularon todos los equipos." : "Clave guardada.");
}

export async function removeStaffPassword() {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  await clearStaffPassword(tenant.id);
  revalidatePath(PATH);
}
