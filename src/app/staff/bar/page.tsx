import type { Metadata } from "next";
import { KdsBoard } from "@/components/kds/kds-board";
import { requireTenantRole } from "@/lib/auth/guards";
import { getKdsData } from "@/lib/kds";

export const metadata: Metadata = { title: "Barra" };

/** Pantalla de Barra (KDS): pensada para tablet o monitor; se actualiza en vivo. */
export default async function KdsPage() {
  const { tdb } = await requireTenantRole(["OWNER", "ADMIN", "BAR"], "KDS");
  const orders = await getKdsData(tdb, "BAR");
  return <KdsBoard orders={orders} station="BAR" />;
}
