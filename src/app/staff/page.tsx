import { redirect } from "next/navigation";
import { requireTenantRole } from "@/lib/auth/guards";
import { STAFF_ROLES, staffHome } from "@/lib/auth/permissions";

export default async function StaffIndex() {
  const { membership } = await requireTenantRole(STAFF_ROLES);
  redirect(staffHome(membership.role));
}
