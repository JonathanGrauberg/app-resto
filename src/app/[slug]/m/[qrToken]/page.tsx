import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { getPublicMenu, getPublicTenant, toVenue } from "@/lib/public-menu";
import { readDiner } from "@/lib/diner";
import { tableChannel } from "@/lib/realtime/server";
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
export default async function TableEntryPage({ params }: PageProps<"/[slug]/m/[qrToken]">) {
  const { slug, qrToken } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const ctx = await tableContext(slug, qrToken);
  if (!ctx || ctx.table.status === "DISABLED") notFound();

  const [menu, diner] = await Promise.all([getPublicMenu(tenant.id), currentDiner(ctx)]);
  const state = diner ? await dinerTableState(ctx) : { cart: [], orders: [] };
  const sessionStatus = !ctx.session ? "NONE" : ctx.session.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "OPEN";
  const receiptUrl = ctx.session?.receiptToken ? `/${tenant.slug}/cuenta/${ctx.session.receiptToken}` : null;

  // ¿Este celular estuvo en una mesa que ya pagó? Se le ofrece su cuenta mientras siga vigente (24 h).
  const old = diner ? null : await readDiner(tenant.id);
  const paidReceiptUrl = old ? await paidReceiptPath(tenant, old.sessionId) : null;

  return (
    <main className="flex-1 pb-24">
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
