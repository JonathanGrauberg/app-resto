import type { Metadata } from "next";
import { SalaView } from "@/components/sala/sala-view";
import { requireTenantRole } from "@/lib/auth/guards";
import { getPublicMenu } from "@/lib/public-menu";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { getSalaData } from "@/lib/sala";

export const metadata: Metadata = { title: "Sala" };

export default async function MozoPage() {
  const { tdb, tenant, membership } = await requireTenantRole(CAN_MANAGE_TABLES);
  const [data, menu] = await Promise.all([getSalaData(tdb), getPublicMenu(tenant.id)]);
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-3 text-xl font-semibold">Sala</h1>
      <SalaView
        data={data}
        me={{ membershipId: membership.id, role: membership.role }}
        slug={tenant.slug}
        venue={tenant.name}
        menu={menu}
      />
    </div>
  );
}
