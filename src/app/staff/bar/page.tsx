import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KdsBoard } from "@/components/kds/kds-board";
import { requireTenantRole } from "@/lib/auth/guards";
import { getKdsData } from "@/lib/kds";
import { getPrepMode, screenStations } from "@/lib/prep";

export const metadata: Metadata = { title: "Barra" };

/** Pantalla de barra (KDS). Si el local usa una sola pantalla, todo se ve en Cocina. */
export default async function BarPage() {
  const { tdb, tenant, membership } = await requireTenantRole(["OWNER", "ADMIN", "BAR", "COCINA"], "KDS");
  const mode = await getPrepMode(tenant.id);
  if (mode === "SINGLE") redirect("/staff/cocina");
  if (membership.role === "COCINA") redirect("/staff/cocina");
  const orders = await getKdsData(tdb, screenStations(mode, "BAR"));
  return <KdsBoard orders={orders} station="BAR" />;
}
