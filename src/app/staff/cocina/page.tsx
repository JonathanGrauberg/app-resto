import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KdsBoard } from "@/components/kds/kds-board";
import { requireTenantRole } from "@/lib/auth/guards";
import { getKdsData } from "@/lib/kds";
import { getPrepMode, screenStations } from "@/lib/prep";

export const metadata: Metadata = { title: "Cocina" };

/** Pantalla de cocina (KDS). Si el local usa una sola pantalla, también recibe lo de barra. */
export default async function CocinaPage() {
  const { tdb, tenant, membership } = await requireTenantRole(["OWNER", "ADMIN", "COCINA", "BAR"], "KDS");
  const mode = await getPrepMode(tenant.id);
  if (membership.role === "BAR" && mode === "SEPARATE") redirect("/staff/bar");
  const orders = await getKdsData(tdb, screenStations(mode, "KITCHEN"));
  return <KdsBoard orders={orders} station="KITCHEN" single={mode === "SINGLE"} />;
}
