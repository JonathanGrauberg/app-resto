import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { BILLING_LABEL, BILLING_TONE } from "@/lib/subscription";
import { normalize } from "@/lib/format";
import { planOf } from "@/lib/plans";
import { tenantsOverview } from "@/lib/platform";
import { COUNTRIES, formatMoney } from "@/lib/region";

export const metadata: Metadata = { title: "Locales" };

/** Todos los locales: buscador, filtros por país y estado, uso de los últimos 30 días. */
export default async function LocalesPage({ searchParams }: PageProps<"/platform/locales">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const pais = typeof sp.pais === "string" ? sp.pais : "";
  const estado = typeof sp.estado === "string" ? sp.estado : "";

  const all = await tenantsOverview();
  const tenants = all.filter(
    (t) =>
      (!q || normalize(`${t.name} ${t.slug} ${t.owners.map((o) => `${o.name} ${o.email}`).join(" ")}`).includes(normalize(q))) &&
      (!pais || t.region.country === pais) &&
      (!estado ||
        (estado === "activos"
          ? t.active
          : estado === "suspendidos"
            ? !t.active
            : estado === "vencidos"
              ? t.billing.kind === "overdue"
              : t.billing.kind === "trial")),
  );

  return (
    <>
      <PageHeader
        title="Locales"
        description={`${all.length} en total · ${all.filter((t) => t.active).length} activos`}
        actions={
          <ButtonLink href="/platform/locales/nuevo">
            <Plus className="size-4" aria-hidden /> Nuevo local
          </ButtonLink>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/platform/locales">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, dirección web, dueño o email"
            aria-label="Buscar locales"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm"
          />
        </label>
        <select name="pais" defaultValue={pais} aria-label="País" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">Todos los países</option>
          {Object.entries(COUNTRIES).map(([code, c]) => (
            <option key={code} value={code}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado} aria-label="Estado" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">Activos y suspendidos</option>
          <option value="activos">Solo activos</option>
          <option value="suspendidos">Solo suspendidos</option>
          <option value="vencidos">Pago vencido</option>
          <option value="prueba">En prueba</option>
        </select>
        <button className="h-10 rounded-xl bg-ink px-4 text-sm font-medium text-bg">Filtrar</button>
      </form>

      {tenants.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Ningún local coincide con la búsqueda.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {tenants.map((t) => {
            const plan = planOf(t.modules);
            return (
              <Link key={t.id} href={`/platform/locales/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-bg sm:p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-semibold">{t.name}</p>
                    <Badge>{COUNTRIES[t.region.country].label}</Badge>
                    <Badge tone="brand">{plan ? plan.label : `${t.modules.length} módulos`}</Badge>
                    {!t.active && <Badge tone="danger">Suspendido</Badge>}
                    {t.active && t.billing.kind !== "free" && (
                      <Badge tone={BILLING_TONE[t.billing.kind]}>{BILLING_LABEL[t.billing.kind]}</Badge>
                    )}
                    {t.active && t.idle && <Badge tone="warn">Sin uso reciente</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted">
                    /{t.slug}
                    {t.owners[0] && ` · ${t.owners[0].name}${t.owners[0].email ? ` · ${t.owners[0].email}` : ""}`}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right text-sm sm:block">
                  <p className="tabular-nums">{t.sessions30} mesas · {formatMoney(t.revenue30, t.region)}</p>
                  <p className="text-xs text-muted">
                    últimos 30 días · alta {t.createdAt.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
