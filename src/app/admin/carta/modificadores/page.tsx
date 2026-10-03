import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { ModifierGroupForm } from "../modifier-group-form";

export const metadata: Metadata = { title: "Opciones y extras" };

export default async function ModificadoresPage() {
  const { tdb } = await requireTenantRole(ADMIN_ROLES);
  // Solo grupos compartidos: los "extras de este plato" se editan desde cada producto.
  const groups = await tdb.modifierGroup.findMany({
    where: { ownerProductId: null },
    orderBy: { name: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } }, _count: { select: { products: true } } },
  });

  return (
    <>
      <Link href="/admin/carta" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Carta
      </Link>
      <PageHeader
        title="Opciones y extras"
        description="Grupos reutilizables que el comensal elige al pedir. Se asignan desde cada producto."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="mb-1.5 text-xs text-muted">
              Usado en {g._count.products} {g._count.products === 1 ? "producto" : "productos"}
            </p>
            <ModifierGroupForm
              values={{
                id: g.id,
                name: g.name,
                minSelect: g.minSelect,
                maxSelect: g.maxSelect,
                options: g.options,
                usedBy: g._count.products,
              }}
            />
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-semibold">Nuevo grupo</h2>
      <div className="xl:max-w-[calc(50%-0.5rem)]">
        <ModifierGroupForm values={{ name: "", minSelect: 0, maxSelect: 1, options: [] }} />
      </div>
    </>
  );
}
