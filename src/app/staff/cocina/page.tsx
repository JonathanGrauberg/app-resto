import type { Metadata } from "next";
import { KdsBoard } from "@/components/kds/kds-board";
import { requireTenantRole } from "@/lib/auth/guards";
import { getKdsData } from "@/lib/kds";

export const metadata: Metadata = { title: "Cocina" };

/** Pantalla de Cocina (KDS): pensada para tablet o monitor; se actualiza en vivo. */
export default async function KdsPage() {
  const { tdb } = await requireTenantRole(["OWNER", "ADMIN", "COCINA"], "KDS");
  const orders = await getKdsData(tdb, "KITCHEN");
  return <KdsBoard orders={orders} station="KITCHEN" />;
}
