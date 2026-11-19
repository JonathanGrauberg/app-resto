"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkbox, fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { normalizeUsername, saveStaffAccount, STAFF_PASSWORD_MIN, STAFF_USERNAME_RE } from "@/lib/auth/devices";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

const schema = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .refine((v) => STAFF_USERNAME_RE.test(v), "De 3 a 30 letras o números, sin espacios (podés usar . - _)"),
  password: z.string().max(100),
  unpairAll: checkbox,
});

/** Crea o cambia la cuenta del personal (usuario + contraseña para las compus y tablets del local). */
export async function saveStaffAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { username, password, unpairAll } = parsed.data;

  const current = await db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { staffPasswordHash: true } });
  // La primera vez la contraseña es obligatoria; después, vacía = no se cambia.
  if ((password || !current?.staffPasswordHash) && password.length < STAFF_PASSWORD_MIN) {
    return { error: "Revisá los campos marcados", fieldErrors: { password: `Mínimo ${STAFF_PASSWORD_MIN} caracteres` } };
  }

  const r = await saveStaffAccount(tenant.id, username, password || null, unpairAll);
  if ("error" in r) return { error: r.error, fieldErrors: { username: "Ya existe" } };
  revalidatePath("/admin/personal", "layout");
  return success(unpairAll ? "Guardado. Todos los equipos vuelven a pedir usuario y contraseña." : "Cuenta del personal guardada.");
}
