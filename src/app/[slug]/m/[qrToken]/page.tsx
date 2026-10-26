import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { LinksPage } from "@/components/links/links-page";
import { QrIntro } from "@/components/links/qr-intro";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { isLinkTheme, readLinks } from "@/lib/links";
import { getPublicMenu, getPublicTenant, toVenue } from "@/lib/public-menu";
import { readDiner } from "@/lib/diner";
import { hasModule } from "@/lib/modules";
import { tableChannel } from "@/lib/realtime/server";
import { tenantDb } from "@/lib/tenant-db";
import { paidReceiptPath } from "@/lib/receipt";
import { currentDiner, dinerTableState, tableContext } from "@/lib/table-session";

export async function generateMetadata({ params }: PageProps<"/[slug]/m/[qrToken]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  return {
    title: tenant ? `${tenant.name} · Carta` : undefined,
    robots: { index: false },
    ...(tenant?.settings?.logoUrl ? { icons: { icon: tenant.settings.logoUrl, apple: tenant.settings.logoUrl } } : {}),
  };
}

/**
 * Entrada por QR de mesa: carta + carrito compartido en vivo + pedidos + llamar al mozo.
 * El comensal se une a la mesa recién cuando agrega algo o llama al mozo (mirar la carta no abre la mesa).
 */
export default async function TableEntryPage({ params, searchParams }: PageProps<"/[slug]/m/[qrToken]">) {
  const { slug, qrToken } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const ctx = await tableContext(slug, qrToken);
  if (!ctx || ctx.table.status === "DISABLED") notFound();

  // Página de enlaces (si el local la activó): lo primero que se ve; "Ver la carta" entra a la mesa.
  const s = tenant.settings;
  if (s?.linksEnabled && (await searchParams).carta !== "1") {
    return (
      <>
        <QrIntro slug={tenant.slug} />
        <LinksPage
          venue={{ name: tenant.name, tagline: s.tagline, logoUrl: s.logoUrl, coverImageUrl: s.coverImageUrl }}
          links={readLinks(s)}
          theme={isLinkTheme(s.linksTheme) ? s.linksTheme : "dark"}
          cartaHref={`/${tenant.slug}/m/${qrToken}?carta=1`}
          bookingHref={(await hasModule(tenant.id, "RESERVAS")) ? `/${tenant.slug}/reservar` : null}
          country={s.country}
        />
      </>
    );
  }

  const [menu, diner] = await Promise.all([getPublicMenu(tenant.id), currentDiner(ctx)]);
  const state = diner ? await dinerTableState(ctx) : { cart: [], orders: [] };
  const sessionStatus = !ctx.session ? "NONE" : ctx.session.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "OPEN";
  // Muro: botón "Chat" en la barra; si la mesa ya tiene su chat, se muestra destacado.
  const chat = (await hasModule(tenant.id, "MURO"))
    ? {
        code: ctx.session
          ? ((await tenantDb(tenant.id).chatRoom.findFirst({
              where: { sessionId: ctx.session.id, closedAt: null, linkedRoomIds: { isEmpty: true } },
              select: { code: true },
            }))?.code ?? null)
          : null,
      }
    : null;
  const receiptUrl = ctx.session?.receiptToken ? `/${tenant.slug}/cuenta/${ctx.session.receiptToken}` : null;

  // ¿Este celular estuvo en una mesa que ya pagó? Se le ofrece su cuenta mientras siga vigente (24 h).
  const old = diner ? null : await readDiner(tenant.id);
  const paidReceiptUrl = old ? await paidReceiptPath(tenant, old.sessionId) : null;

  return (
    <main className="flex-1 pb-24">
      <QrIntro slug={tenant.slug} />
      <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />
      <MenuExperience
        venue={toVenue(tenant)}
        menu={menu}
        table={{
          slug: tenant.slug,
          qrToken,
          label: ctx.label,
          venue: tenant.name,
          sessionId: ctx.session?.id ?? null,
          sessionStatus,
          receiptUrl,
          diner: diner ? { nickname: diner.nickname, dinerId: diner.dinerId } : null,
          channel: diner && ctx.session ? tableChannel(tenant.id, ctx.session.id) : null,
          reviewUrl: tenant.settings?.googleReviewUrl ?? null,
          state,
          chat,
        }}
        notice={
          <>
            {paidReceiptUrl && (
              <Link
                href={paidReceiptUrl}
                className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm ring-1 ring-brand/30"
              >
                <ReceiptText className="size-5 shrink-0 text-brand" aria-hidden />
                <span className="flex-1">
                  <span className="block font-semibold">Tu mesa ya pagó</span>
                  <span className="text-muted">Ver el detalle de la cuenta y cuánto le toca a cada uno</span>
                </span>
              </Link>
            )}
            {sessionStatus === "PENDING_PAYMENT" && !diner && (
              <p role="status" className="mt-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
                Esta mesa está cerrando la cuenta. Si recién te sentás, avisale al personal.
              </p>
            )}
          </>
        }
      />
    </main>
  );
}
