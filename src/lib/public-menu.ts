import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";

/** Datos públicos del local para la carta del comensal. */
export const getPublicTenant = cache(async (slug: string) => {
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { settings: true } });
  if (!tenant || !tenant.active) return null;
  return tenant;
});

type PublicTenant = NonNullable<Awaited<ReturnType<typeof getPublicTenant>>>;

/** Datos de portada serializables para el cliente. */
/** `bookingUrl`: enlace a reservar (solo en la carta pública, si el local toma reservas online). */
export function toVenue(t: PublicTenant, bookingUrl: string | null = null) {
  return {
    bookingUrl,
    name: t.name,
    slug: t.slug,
    tagline: t.settings?.tagline ?? null,
    description: t.settings?.description ?? null,
    address: t.settings?.address ?? null,
    instagramUrl: t.settings?.instagramUrl ?? null,
    facebookUrl: t.settings?.facebookUrl ?? null,
    websiteUrl: t.settings?.websiteUrl ?? null,
    menuTheme: t.settings?.menuTheme ?? "DARK",
    coverImageUrl: t.settings?.coverImageUrl ?? null,
    logoUrl: t.settings?.logoUrl ?? null,
  };
}

export async function getPublicMenu(tenantId: string) {
  const tdb = tenantDb(tenantId);
  const categories = await tdb.category.findMany({
    where: { visible: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { visible: true },
        orderBy: { sortOrder: "asc" },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: { group: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
          },
        },
      },
    },
  });

  // Se serializa solo lo necesario para el cliente.
  return categories
    .filter((c) => c.products.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        station: p.station,
        allergens: p.allergens,
        tags: p.tags,
        available: p.available,
        modifierGroups: p.modifierGroups.map(({ group }) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: group.options.map((o) => ({ id: o.id, name: o.name, extraPriceCents: o.extraPriceCents })),
        })),
      })),
    }));
}

export type PublicMenu = Awaited<ReturnType<typeof getPublicMenu>>;
export type PublicProduct = PublicMenu[number]["products"][number];
