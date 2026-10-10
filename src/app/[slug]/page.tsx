import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { getBookingConfig } from "@/lib/booking";
import { hasModule } from "@/lib/modules";
import { getPublicMenu, getPublicTenant, toVenue } from "@/lib/public-menu";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return {};
  const s = tenant.settings;
  const title = `${tenant.name} · Carta`;
  const description = s?.description ?? s?.tagline ?? `Carta de ${tenant.name}`;
  // Vista previa al compartir: imagen propia → portada → logo.
  const image = s?.shareImageUrl ?? s?.coverImageUrl ?? s?.logoUrl;
  return {
    title,
    description,
    openGraph: {
      title: tenant.name,
      description,
      type: "website",
      locale: "es_ES",
      siteName: tenant.name,
      ...(image ? { images: [{ url: image, alt: tenant.name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: tenant.name, description, ...(image ? { images: [image] } : {}) },
    ...(s?.logoUrl ? { icons: { icon: s.logoUrl, apple: s.logoUrl } } : {}),
  };
}

/** Carta pública del local (sin mesa: solo consulta). */
export default async function PublicMenuPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();
  const [menu, booking] = await Promise.all([getPublicMenu(tenant.id), hasModule(tenant.id, "RESERVAS")]);
  // El botón "Reservar" aparece solo si el local tiene reservas y ya cargó horarios.
  const bookingUrl = booking && Object.keys((await getBookingConfig(tenant.id)).hours).length ? `/${tenant.slug}/reservar` : null;

  return (
    <main className="flex-1">
      <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />
      <MenuExperience venue={toVenue(tenant, bookingUrl)} menu={menu} />
    </main>
  );
}
