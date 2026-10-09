import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { formatPrice } from "@/lib/format";
import { getPrepMode } from "@/lib/prep";
import { deleteProduct } from "../../actions";
import { ProductForm, type ProductValues } from "../../product-form";

export const metadata: Metadata = { title: "Producto" };

/** `/admin/carta/producto/nuevo` crea; `/admin/carta/producto/<id>` edita. */
export default async function ProductPage({ params, searchParams }: PageProps<"/admin/carta/producto/[id]">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES);
  const { id } = await params;
  const { categoria } = await searchParams;
  const isNew = id === "nuevo";

  const [categories, groups, product, prepMode] = await Promise.all([
    tdb.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    tdb.modifierGroup.findMany({
      where: { ownerProductId: null },
      orderBy: { name: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    }),
    isNew
      ? null
      : tdb.product.findUnique({
          where: { id },
          include: { modifierGroups: true, ownGroup: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
        }),
    getPrepMode(tenant.id),
  ]);
  if (!isNew && !product) notFound();

  const values: ProductValues = product
    ? {
        id: product.id,
        imageUrl: product.imageUrl,
        name: product.name,
        description: product.description ?? "",
        price: (product.priceCents / 100).toFixed(2).replace(".", ","),
        categoryId: product.categoryId,
        station: product.station,
        allergens: product.allergens,
        modifierGroupIds: product.modifierGroups.map((m) => m.groupId).filter((g) => g !== product.ownGroup?.id),
        ownExtras: product.ownGroup?.options.map((o) => ({ name: o.name, extraPriceCents: o.extraPriceCents })) ?? [],
        tags: product.tags.join(", "),
        available: product.available,
        visible: product.visible,
      }
    : {
        imageUrl: null,
        name: "",
        description: "",
        price: "",
        categoryId: typeof categoria === "string" && categories.some((c) => c.id === categoria) ? categoria : (categories[0]?.id ?? ""),
        station: "KITCHEN",
        allergens: [],
        modifierGroupIds: [],
        ownExtras: [],
        tags: "",
        available: true,
        visible: true,
      };

  return (
    <>
      <Link href="/admin/carta" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Carta
      </Link>
      <PageHeader
        title={product ? product.name : "Nuevo producto"}
        actions={
          product && (
            <ActionButton
              action={deleteProduct.bind(null, product.id)}
              confirm={`¿Borrar "${product.name}"? Los pedidos anteriores no se ven afectados.`}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger-soft"
            >
              <Trash2 className="size-4" aria-hidden /> Borrar
            </ActionButton>
          )
        }
      />
      <ProductForm
        singleScreen={prepMode === "SINGLE"}
        values={values}
        categories={categories}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          summary: g.options
            .map((o) => (o.extraPriceCents ? `${o.name} (+${formatPrice(o.extraPriceCents)})` : o.name))
            .join(", "),
        }))}
      />
    </>
  );
}
