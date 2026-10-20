import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { MODULES, getEnabledModules } from "@/lib/modules";
import { periodOf, purchaseSummary } from "@/lib/purchases";
import { formatMoney } from "@/lib/region";
import { getRegion } from "@/lib/region-server";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Inicio" };

export default async function AdminHome() {
  const { tenant, tdb } = await requireTenantRole(ADMIN_ROLES);

  const [products, categories, tables, areas, staff, openSessions, modules] = await Promise.all([
    tdb.product.count(),
    tdb.category.count(),
    tdb.table.count({ where: { archivedAt: null, temporary: false } }),
    tdb.area.count(),
    tdb.membership.count({ where: { active: true } }),
    tdb.tableSession.count({ where: { status: { not: "CLOSED" } } }),
    getEnabledModules(tenant.id),
  ]);

  // Compras: vendido vs comprado de la semana y del mes, a la vista apenas se entra.
  const region = await getRegion(tenant.id);
  const money = (c: number) => formatMoney(c, region);
  const balance = modules.has("COMPRAS")
    ? await Promise.all(
        (["semana", "mes"] as const).map(async (k) => {
          const p = periodOf(k, undefined, region.timezone, region.locale);
          return { kind: k, label: k === "semana" ? "Esta semana" : "Este mes", ...(await purchaseSummary(tdb, p.from, p.to)) };
        }),
      )
    : null;

  const stats = [
    { label: "Mesas ocupadas", value: `${openSessions}/${tables}`, href: "/admin/mesas" },
    { label: "Productos", value: products, hint: `${categories} categorías`, href: "/admin/carta" },
    { label: "Salones", value: areas, href: "/admin/mesas" },
    { label: "Personal activo", value: staff, href: "/admin/personal" },
  ];

  return (
    <>
      <PageHeader
        title="Inicio"
        description="Resumen del local"
        actions={
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand"
          >
            Ver carta pública <ExternalLink className="size-4" aria-hidden />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-4 transition-colors hover:border-brand">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</p>
              {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
            </Card>
          </Link>
        ))}
      </div>

      {balance && (
        <>
          <h2 className="mb-3 mt-8 font-semibold">Vendido vs comprado</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {balance.map((b) => (
              <Link key={b.kind} href={`/admin/compras?periodo=${b.kind}`}>
                <Card className="p-4 transition-colors hover:border-brand">
                  <p className="text-sm text-muted">{b.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted">Vendido</p>
                      <p className="font-semibold tabular-nums">{money(b.soldCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Comprado</p>
                      <p className="font-semibold tabular-nums">{money(b.purchasedCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Resultado</p>
                      <p className={cn("font-bold tabular-nums", b.resultCents >= 0 ? "text-ok" : "text-danger")}>{money(b.resultCents)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Módulos del plan</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const on = modules.has(m.key);
          return (
            <Card key={m.key} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{m.label}</p>
                <p className="text-sm text-muted">{m.description}</p>
              </div>
              <Badge tone={on ? "ok" : "neutral"}>{on ? "Activo" : "No incluido"}</Badge>
            </Card>
          );
        })}
      </div>
    </>
  );
}
