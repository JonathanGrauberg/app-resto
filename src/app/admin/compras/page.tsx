import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { localParts } from "@/lib/booking";
import { cn } from "@/lib/format";
import { PURCHASE_CATEGORY_LABEL } from "@/lib/purchase-labels";
import { periodOf, purchaseSummary, type PeriodKind } from "@/lib/purchases";
import { formatMoney } from "@/lib/region";
import { getRegion } from "@/lib/region-server";
import { deletePurchase } from "./actions";
import { PurchaseForm } from "./purchase-form";

export const metadata: Metadata = { title: "Compras" };

/** Compras del local y comparación con lo vendido, por semana o por mes. */
export default async function ComprasPage({ searchParams }: PageProps<"/admin/compras">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "COMPRAS");
  const region = await getRegion(tenant.id);
  const sp = await searchParams;
  const kind: PeriodKind = sp.periodo === "mes" ? "mes" : "semana";
  const p = periodOf(kind, typeof sp.ref === "string" ? sp.ref : undefined, region.timezone, region.locale);
  const s = await purchaseSummary(tdb, p.from, p.to);
  const money = (c: number) => formatMoney(c, region);
  const href = (o: { periodo?: PeriodKind; ref?: string }) => `/admin/compras?periodo=${o.periodo ?? kind}&ref=${o.ref ?? p.start}`;
  const dayLabel = (d: Date) =>
    new Date(`${localParts(d, region.timezone).date}T12:00:00Z`).toLocaleDateString(region.locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  // Margen sobre lo vendido, para leer rápido si el período dejó plata.
  const margin = s.soldCents > 0 ? Math.round((s.resultCents / s.soldCents) * 100) : null;

  return (
    <>
      <PageHeader
        title="Compras"
        description="Cargá lo que comprás y compará con lo vendido en caja."
        actions={
          <a
            href={`/admin/compras/export?periodo=${kind}&ref=${p.start}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:bg-bg"
          >
            <Download className="size-4" aria-hidden /> Exportar (Excel)
          </a>
        }
      />

      {/* Período */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Período">
          {(["semana", "mes"] as const).map((k) => (
            <Link
              key={k}
              href={href({ periodo: k, ref: p.today })}
              role="tab"
              aria-selected={k === kind}
              className={cn("rounded-lg px-4 py-1.5 text-sm font-medium capitalize", k === kind ? "bg-surface shadow-sm" : "text-muted hover:text-ink")}
            >
              {k}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={href({ ref: p.prev })} aria-label="Período anterior" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface hover:bg-bg">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={href({ ref: p.next })} aria-label="Período siguiente" className="flex size-10 items-center justify-center rounded-xl border border-line bg-surface hover:bg-bg">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <h2 className="text-lg font-semibold">{p.label}</h2>
        {!p.isCurrent && (
          <Link href={href({ ref: p.today })} className="text-sm font-medium text-brand">
            Ir {kind === "semana" ? "a esta semana" : "a este mes"}
          </Link>
        )}
      </div>

      {/* Vendido vs comprado */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted">Vendido</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(s.soldCents)}</p>
          <p className="text-xs text-muted">
            {s.tables} {s.tables === 1 ? "mesa cobrada" : "mesas cobradas"}
            {s.tipsCents > 0 && ` · propinas aparte: ${money(s.tipsCents)}`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Comprado</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(s.purchasedCents)}</p>
          <p className="text-xs text-muted">
            {s.purchases.length} {s.purchases.length === 1 ? "compra" : "compras"}
          </p>
        </Card>
        <Card className={cn("p-4", s.resultCents >= 0 ? "border-ok/40 bg-ok-soft/40" : "border-danger/40 bg-danger-soft/40")}>
          <p className="text-sm text-muted">Resultado (vendido − comprado)</p>
          <p className={cn("mt-1 text-3xl font-bold tabular-nums", s.resultCents >= 0 ? "text-ok" : "text-danger")}>{money(s.resultCents)}</p>
          <p className="text-xs text-muted">{margin !== null ? `${margin}% de lo vendido` : "Sin ventas en el período"}</p>
        </Card>
      </div>
      <p className="mt-2 text-xs text-muted">
        Vendido = lo cobrado en caja en el período (sin propinas). No descuenta sueldos, alquiler ni impuestos: es lo vendido contra lo comprado.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-4">
          {/* Por categoría */}
          {s.purchasedCents > 0 && (
            <div className="flex flex-wrap gap-2">
              {s.byCategory
                .filter((c) => c.amountCents > 0)
                .map((c) => (
                  <span key={c.category} className="rounded-full bg-ink/5 px-3 py-1 text-sm">
                    {PURCHASE_CATEGORY_LABEL[c.category]} · <strong className="tabular-nums">{money(c.amountCents)}</strong>
                  </span>
                ))}
            </div>
          )}

          {/* Lista */}
          {s.purchases.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">No hay compras cargadas en este período.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {s.purchases.map((x) => (
                <div key={x.id} className="flex items-center gap-3 p-3 sm:px-4">
                  <span className="w-20 shrink-0 text-sm capitalize text-muted">{dayLabel(x.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {x.item}
                      {x.quantity && <span className="font-normal text-muted"> · {x.quantity}</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {PURCHASE_CATEGORY_LABEL[x.category]}
                      {x.supplier && ` · ${x.supplier}`}
                      {x.notes && ` · ${x.notes}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{money(x.amountCents)}</span>
                  <ActionButton
                    action={deletePurchase.bind(null, x.id)}
                    confirm={`¿Borrar "${x.item}" (${money(x.amountCents)})?`}
                    className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-label="Borrar compra" />
                  </ActionButton>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 font-semibold sm:px-4">
                <span>Total comprado</span>
                <span className="tabular-nums">{money(s.purchasedCents)}</span>
              </div>
            </Card>
          )}
        </div>

        <PurchaseForm today={p.today} />
      </div>
    </>
  );
}
