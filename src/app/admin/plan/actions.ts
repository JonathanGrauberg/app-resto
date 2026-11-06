"use server";

import { revalidatePath } from "next/cache";
import { fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { redeemProCode } from "@/lib/pro";

/** El local ingresa el código PRO que le dimos al cerrar la venta. */
export async function redeemCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const r = await redeemProCode(tenant.id, String(formData.get("code") ?? ""));
  if (!r.ok) return fail(r.error);
  revalidatePath("/admin", "layout");
  return success(r.message);
}
