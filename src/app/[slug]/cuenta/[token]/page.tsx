import type { Metadata } from "next";
import { Clock, ReceiptText } from "lucide-react";
import { MenuThemeScript } from "@/components/menu/menu-theme-script";
import { getPublicTenant } from "@/lib/public-menu";
import { receiptByToken } from "@/lib/receipt";
import { SplitBill } from "./split-bill";

export const metadata: Metadata = { title: "Tu cuenta", robots: { index: false } };

/** Cuenta de la mesa por el QR del ticket (o "Ver la cuenta" en la mesa): detalle por persona y dividir. */
export default async function ReceiptPage({ params }: PageProps<"/[slug]/cuenta/[token]">) {
  const { slug, token } = await params;
  const [result, tenant] = await Promise.all([receiptByToken(slug, token), getPublicTenant(slug)]);

  if (result.state !== "ok") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {tenant && <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />}
        <Clock className="size-10 text-muted" aria-hidden />
        <h1 className="text-xl font-semibold">
          {result.state === "expired" ? "Esta cuenta ya no está disponible" : "No encontramos esta cuenta"}
        </h1>
        <p className="max-w-sm text-sm text-muted">
          {result.state === "expired"
            ? "El detalle se puede consultar durante 24 horas después de pagar. Si lo necesitás, pedíselo al local."
            : "Revisá que el enlace o el QR sean correctos."}
        </p>
      </main>
    );
  }

  const r = result.receipt;
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      {tenant && <MenuThemeScript slug={tenant.slug} theme={tenant.settings?.menuTheme ?? "DARK"} />}
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{r.venue.name}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <ReceiptText className="size-6" aria-hidden /> Cuenta · Mesa {r.tableLabel}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(r.openedAt).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" })}
          {r.status === "CLOSED" ? " · Pagada" : " · Pendiente de pago"}
        </p>
      </header>

      <SplitBill receipt={r} />

      <p className="mt-8 text-center text-xs text-muted">
        Documento informativo · No válido como factura · IVA incluido
        {r.expiresAt &&
          ` · Disponible hasta el ${new Date(r.expiresAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}`}
      </p>
    </main>
  );
}
