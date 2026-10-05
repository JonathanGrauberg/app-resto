import type { Metadata } from "next";
import { ClosedToday } from "@/components/sala/closed-today";
import { SalaView } from "@/components/sala/sala-view";
import { ShiftBar } from "@/components/sala/shift-bar";
import { requireTenantRole } from "@/lib/auth/guards";
import { getPublicMenu } from "@/lib/public-menu";
import { getClosedToday, getSalaData } from "@/lib/sala";
import { currentShift, shiftSummary } from "@/lib/shift";

export const metadata: Metadata = { title: "Caja" };

/** Caja: sala en vivo (confirmar cobros, reasignar mozos, imprimir cuentas) + mesas cobradas hoy para reimprimir. */
export default async function CajaPage() {
  const { tdb, tenant, membership } = await requireTenantRole(["OWNER", "ADMIN", "CAJA"], "CAJA");
  const [data, closed, menu, shift] = await Promise.all([
    getSalaData(tdb),
    getClosedToday(tdb),
    getPublicMenu(tenant.id),
    currentShift(tdb),
  ]);
  const summary = shift ? await shiftSummary(tdb, shift.id) : null;
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-3 text-xl font-semibold">Caja</h1>
      <ShiftBar shift={summary} />
      <SalaView
        data={data}
        me={{ membershipId: membership.id, role: membership.role }}
        slug={tenant.slug}
        venue={tenant.name}
        menu={menu}
      />
      <ClosedToday rows={closed} />
    </div>
  );
}
