import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellRing } from "lucide-react";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { db } from "@/lib/db";
import { getPublicMenu, getPublicTenant, toVenue } from "@/lib/public-menu";

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
 * Entrada por QR de mesa. En la Fase 2 aquí se une el comensal a la sesión de mesa
 * compartida (carrito en vivo, pedir, llamar al mozo).
 */
export default async function TableEntryPage({ params }: PageProps<"/[slug]/m/[qrToken]">) {
  const { slug, qrToken } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  // qrToken es único global; se verifica además que pertenezca a este tenant.
  const table = await db.table.findFirst({ where: { qrToken, tenantId: tenant.id } });
  if (!table || table.status === "DISABLED" || table.archivedAt) notFound();

  const menu = await getPublicMenu(tenant.id);

  return (
    <main className="flex-1 pb-24">
      <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />
      <MenuExperience
        venue={toVenue(tenant)}
        menu={menu}
        tableNumber={table.number}
        notice={
          table.status === "PENDING_PAYMENT" && (
            <p role="status" className="mt-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
              Esta mesa todavía no fue cerrada por caja. Avisá al personal si acabás de sentarte.
            </p>
          )
        }
      />

      {/* Barra de acciones de mesa: se activa en la Fase 2 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 sm:px-2 lg:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Estás en</p>
            <p className="font-semibold leading-tight">Mesa {table.number}</p>
          </div>
          <button
            disabled
            title="Disponible en la Fase 2"
            className="flex h-12 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium disabled:opacity-50"
          >
            <BellRing className="size-4" aria-hidden /> <span className="hidden sm:inline">Llamar</span> mozo
          </button>
          <button
            disabled
            title="Disponible en la Fase 2"
            className="h-12 rounded-full bg-ink px-5 text-sm font-semibold text-bg disabled:opacity-50"
          >
            Ver pedido
          </button>
        </div>
      </div>
    </main>
  );
}
