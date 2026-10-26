import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LinksPage } from "@/components/links/links-page";
import { QrIntro } from "@/components/links/qr-intro";
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

/** Página de enlaces del local para compartir (bio de Instagram, QR general del local…): la misma que se ve al escanear el QR de una mesa. */
export default async function LinksRoute({ params }: PageProps<"/[slug]/enlaces">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  const s = tenant?.settings;
  if (!tenant) notFound();
  // El QR general del local apunta acá: si la página está apagada, va directo a la carta.
  if (!s?.linksEnabled) redirect(`/${tenant.slug}`);
  const hasBooking = await hasModule(tenant.id, "RESERVAS");
  return (
    <>
    <QrIntro slug={tenant.slug} />
    <LinksPage
      venue={{ name: tenant.name, tagline: s.tagline, logoUrl: s.logoUrl, coverImageUrl: s.coverImageUrl }}
      links={readLinks(s, hasBooking)}
      theme={isLinkTheme(s.linksTheme) ? s.linksTheme : "dark"}
      cartaHref={`/${tenant.slug}`}
      bookingHref={hasBooking ? `/${tenant.slug}/reservar` : null}
      country={s.country}
    />
    </>
  );
}
