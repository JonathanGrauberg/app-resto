"use server";

import { revalidatePath } from "next/cache";
import { requireTenantRole } from "@/lib/auth/guards";
import { revokeDevice } from "@/lib/auth/devices";
import { ADMIN_ROLES } from "@/lib/auth/permissions";

export async function removeDevice(deviceId: string) {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  await revokeDevice(tenant.id, deviceId);
  revalidatePath("/admin/personal/equipos");
}
