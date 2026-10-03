import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { cn } from "@/lib/format";
import { toggleModule, toggleTenantActive } from "./actions";
import { CreateTenantForm } from "./create-tenant-form";

export const metadata: Metadata = { title: "Plataforma" };

export default async function PlatformPage() {
  await requirePlatformAdmin();

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      modules: true,
      _count: { select: { tables: true, products: true, memberships: true } },
    },
  });

  return (
    <>
      <PageHeader title="Locales" description="Alta de restaurantes y módulos contratados." />

      <div className="space-y-4">
        {tenants.map((t) => {
          const enabled = new Set(t.modules.filter((m) => m.enabled).map((m) => m.module));
          return (
            <Card key={t.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{t.name}</p>
                    <Badge tone={t.active ? "ok" : "danger"}>{t.active ? "Activo" : "Suspendido"}</Badge>
                  </div>
                  <Link href={`/${t.slug}`} target="_blank" className="text-sm text-brand">
                    /{t.slug}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {t._count.tables} mesas · {t._count.products} productos · {t._count.memberships} usuarios
                  </p>
                </div>
                <form action={toggleTenantActive.bind(null, t.id, !t.active)}>
                  <button className="text-sm text-muted underline-offset-2 hover:underline">
                    {t.active ? "Suspender" : "Reactivar"}
                  </button>
                </form>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {MODULES.map((m) => {
                  const on = enabled.has(m.key);
                  return (
                    <form key={m.key} action={toggleModule.bind(null, t.id, m.key, !on)}>
                      <button
                        title={m.description}
                        aria-pressed={on}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          on ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:border-ink/30",
                        )}
                      >
                        {on ? "✓ " : ""}
                        {m.label}
                      </button>
                    </form>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 font-semibold">Nuevo local</h2>
      <Card className="p-4 sm:p-5">
        <CreateTenantForm />
      </Card>
    </>
  );
}
