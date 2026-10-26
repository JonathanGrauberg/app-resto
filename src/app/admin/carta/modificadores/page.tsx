import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, IceCreamCone } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/ui/field";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { createFlavorsGroup, toggleOptionAvailable } from "../actions";
import { ModifierGroupForm } from "../modifier-group-form";

export const metadata: Metadata = { title: "Opciones y extras" };

export default async function ModificadoresPage({ searchParams }: PageProps<"/admin/carta/modificadores">) {
  const { tdb } = await requireTenantRole(ADMIN_ROLES);
  const { ok } = await searchParams;
  // Solo grupos compartidos: los "extras de este plato" se editan desde cada producto.
  const groups = await tdb.modifierGroup.findMany({
    where: { ownerProductId: null },
    orderBy: { name: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } }, _count: { select: { products: true } } },
  });
  const hasFlavors = groups.some((g) => g.name.toLowerCase() === "gustos");

  return (
    <>
      <Link href="/admin/carta" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Carta
      </Link>
      <PageHeader
        title="Opciones y extras"
        description="Grupos reutilizables que el comensal elige al pedir. Se asignan desde cada producto, y cada producto puede decir cuántas se eligen."
        actions={
          !hasFlavors && (
            <form action={createFlavorsGroup}>
              <button className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-bg">
                <IceCreamCone className="size-4" aria-hidden /> Crear lista de gustos de helado
              </button>
            </form>
          )
        }
      />
      {typeof ok === "string" && (
        <div className="mb-5">
          <FormSuccess message={ok} />
        </div>
      )}

      {groups.length > 0 && (
        <Card className="mb-6 p-4 sm:p-5">
          <h2 className="font-semibold">Stock de hoy</h2>
          <p className="mb-3 text-sm text-muted">Tocá una opción cuando se termina (ej. un gusto): sigue en la carta pero no se puede elegir. Volvé a tocarla cuando haya.</p>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{g.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <form key={o.id} action={toggleOptionAvailable.bind(null, o.id)}>
                      <button
                        aria-pressed={!o.available}
                        title={o.available ? "Marcar sin stock" : "Hay de nuevo"}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm",
                          o.available ? "border-line hover:border-ink/30" : "border-danger/40 bg-danger-soft text-danger line-through",
                        )}
                      >
                        {o.name}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                allowRepeat: g.allowRepeat,
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
