import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Plus, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Photo } from "@/components/mock-image";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/ui/field";
import { ALLERGENS } from "@/lib/allergens";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { formatPrice } from "@/lib/format";
import { CategoryHeader } from "./category-forms";
import { ProductRowActions } from "./product-row-actions";

export const metadata: Metadata = { title: "Carta" };

export default async function AdminCartaPage({ searchParams }: PageProps<"/admin/carta">) {
  const { tdb } = await requireTenantRole(ADMIN_ROLES);
  const { ok } = await searchParams;

  const categories = await tdb.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: { modifierGroups: { include: { group: { select: { name: true } } } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Carta"
        description="Categorías, productos, alérgenos y opciones."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/carta/modificadores" variant="secondary">
              <SlidersHorizontal className="size-4" aria-hidden /> Opciones y extras
            </ButtonLink>
            <ButtonLink href="/admin/carta/producto/nuevo">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </ButtonLink>
          </div>
        }
      />

      {typeof ok === "string" && (
        <div className="mb-6">
          <FormSuccess message={ok} />
        </div>
      )}

      <div className="space-y-10">
        {categories.map((c, ci) => (
          <section key={c.id}>
            <CategoryHeader
              id={c.id}
              name={c.name}
              visible={c.visible}
              count={c.products.length}
              first={ci === 0}
              last={ci === categories.length - 1}
            />
            <Card className="divide-y divide-line">
              {c.products.map((p, pi) => (
                <div key={p.id} className="flex items-center gap-3 p-3 sm:px-4">
                  <Link href={`/admin/carta/producto/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Photo
                      src={p.imageUrl}
                      seed={p.id}
                      kind={p.station === "BAR" ? "bar" : "kitchen"}
                      fade="bottom"
                      to="surface"
                      className="size-12 shrink-0 rounded-lg sm:size-14"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium hover:underline">{p.name}</p>
                        {!p.visible && (
                          <Badge>
                            <EyeOff className="size-3" aria-hidden /> Oculto
                          </Badge>
                        )}
                        <Badge tone={p.station === "BAR" ? "brand" : "neutral"}>
                          {p.station === "BAR" ? "Bar" : p.station === "KITCHEN" ? "Cocina" : "Sin preparación"}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted">
                        {p.allergens.length > 0
                          ? p.allergens.map((a) => ALLERGENS[a].label).join(", ")
                          : "Sin alérgenos declarados"}
                        {p.modifierGroups.length > 0 && ` · ${p.modifierGroups.map((m) => m.group.name).join(", ")}`}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatPrice(p.priceCents)}</p>
                  </Link>
                  <ProductRowActions
                    id={p.id}
                    available={p.available}
                    first={pi === 0}
                    last={pi === c.products.length - 1}
                  />
                </div>
              ))}
              <Link
                href={`/admin/carta/producto/nuevo?categoria=${c.id}`}
                className="flex items-center gap-2 p-3 text-sm font-medium text-brand hover:bg-bg sm:px-4"
              >
                <Plus className="size-4" aria-hidden /> Añadir producto en {c.name}
              </Link>
            </Card>
          </section>
        ))}

        {categories.length === 0 && (
          <Card className="p-6 text-center">
            <p className="font-medium">La carta está vacía</p>
            <p className="mt-1 text-sm text-muted">
              Creá el primer producto. La categoría (Entrantes, Bebidas…) se elige o se crea ahí mismo.
            </p>
            <ButtonLink href="/admin/carta/producto/nuevo" className="mt-4">
              <Plus className="size-4" aria-hidden /> Nuevo producto
            </ButtonLink>
          </Card>
        )}
      </div>
    </>
  );
}
