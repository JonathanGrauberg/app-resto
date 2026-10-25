import { RegionProvider } from "@/components/region-provider";
import { getPublicTenant } from "@/lib/public-menu";
import { regionOf } from "@/lib/region";

/** Páginas públicas del local: moneda y formato según su país, y la paleta neutra de la carta (`.carta`). */
export default async function VenueLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  return (
    <RegionProvider region={regionOf(tenant?.settings)}>
      <div className="carta flex flex-1 flex-col">{children}</div>
    </RegionProvider>
  );
}
