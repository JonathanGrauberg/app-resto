import type { Metadata } from "next";
import { SalaView } from "@/components/sala/sala-view";
import { requireTenantRole } from "@/lib/auth/guards";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { getSalaData } from "@/lib/sala";

export const metadata: Metadata = { title: "Sala" };

export default async function MozoPage() {
  const { tdb, tenant, membership } = await requireTenantRole(CAN_MANAGE_TABLES);
  const data = await getSalaData(tdb);
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-3 text-xl font-semibold">Sala</h1>
      <SalaView
        data={data}
        me={{ membershipId: membership.id, role: membership.role }}
        slug={tenant.slug}
        venue={tenant.name}
      />
    </div>
  );
}
