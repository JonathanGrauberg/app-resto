import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinksPage } from "@/components/links/links-page";
import { isLinkTheme, readLinks } from "@/lib/links";
import { hasModule } from "@/lib/modules";
import { getPublicTenant } from "@/lib/public-menu";

export async function generateMetadata({ params }: PageProps<"/[slug]/enlaces">): Promise<Metadata> {
  const tenant = await getPublicTenant((await params).slug);
  return {
    title: tenant ? `${tenant.name} · Enlaces` : undefined,
    ...(tenant?.settings?.logoUrl ? { icons: { icon: tenant.settings.logoUrl, apple: tenant.settings.logoUrl } } : {}),
  };
}

/** Página de enlaces del local para compartir (bio de Instagram, WhatsApp…): la misma que se ve al escanear el QR. */
export default async function LinksRoute({ params }: PageProps<"/[slug]/enlaces">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  const s = tenant?.settings;
  if (!tenant || !s?.linksEnabled) notFound();
  return (
    <LinksPage
      venue={{ name: tenant.name, tagline: s.tagline, logoUrl: s.logoUrl, coverImageUrl: s.coverImageUrl }}
      links={readLinks(s)}
      theme={isLinkTheme(s.linksTheme) ? s.linksTheme : "dark"}
      cartaHref={`/${tenant.slug}`}
      bookingHref={(await hasModule(tenant.id, "RESERVAS")) ? `/${tenant.slug}/reservar` : null}
      country={s.country}
    />
  );
}
