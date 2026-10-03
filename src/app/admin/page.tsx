import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { MODULES, getEnabledModules } from "@/lib/modules";

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
