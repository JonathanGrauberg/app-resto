"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { createPairing, pairThisDevice, revokeDevice } from "@/lib/auth/devices";
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
