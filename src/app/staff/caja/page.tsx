import type { Metadata } from "next";
import { SalaView } from "@/components/sala/sala-view";
import { requireTenantRole } from "@/lib/auth/guards";
import { getSalaData } from "@/lib/sala";

export const metadata: Metadata = { title: "Caja" };

/** Caja: misma sala en vivo, con permisos para confirmar cobros y reasignar mozos. Pre-cuenta en Fase 4. */
export default async function CajaPage() {
  const { tdb, tenant, membership } = await requireTenantRole(["OWNER", "ADMIN", "CAJA"], "CAJA");
  const data = await getSalaData(tdb);
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-3 text-xl font-semibold">Caja</h1>
      <SalaView
        data={data}
        me={{ membershipId: membership.id, role: membership.role }}
        slug={tenant.slug}
        venue={tenant.name}
      />
    </div>
  );
}
