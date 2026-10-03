import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireTenantRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Cocina" };

/** KDS de Cocina: pensado para tablet/pantalla en horizontal. */
export default async function CocinaPage() {
  await requireTenantRole(["OWNER", "ADMIN", "COCINA"], "KDS");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pantalla de Cocina</h1>
      <div className="grid gap-3 md:grid-cols-3">
        {["Pendientes", "En preparación", "Listos"].map((col) => (
          <div key={col} className="min-h-40 rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm font-medium text-muted">{col}</p>
          </div>
        ))}
      </div>
      <ComingSoon title="Comandas en vivo por estación (KITCHEN)" phase="Fase 3" />
    </div>
  );
}
