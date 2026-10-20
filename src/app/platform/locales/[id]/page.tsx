import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { FormSuccess } from "@/components/ui/field";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { ROLE_LABEL, rolesOf, sortRoles } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { MODULES } from "@/lib/modules";
import { PLANS, planOf } from "@/lib/plans";
import { tenantDetail } from "@/lib/platform";
import { COUNTRIES, formatMoney, isRoundCurrency } from "@/lib/region";
import { applyPlan, setModuleExpiry, toggleModule, toggleTenantActive } from "../../actions";

export const metadata: Metadata = { title: "Local" };

/** Ficha de un local: datos, personal, módulos (con vencimiento), plan y uso del último mes. */
export default async function TenantPage({ params, searchParams }: PageProps<"/platform/locales/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { ok } = await searchParams;
  const detail = await tenantDetail(id);
  if (!detail) notFound();
  const { tenant: t, region, usage: u } = detail;
  const enabled = new Map(t.modules.map((m) => [m.module, m]));
  const plan = planOf(detail.activeModules);
  const money = (c: number) => formatMoney(c, region);
  const date = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <Link href="/platform/locales" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Locales
      </Link>
      <PageHeader
        title={t.name}
        description={`/${t.slug} · ${COUNTRIES[region.country].label} · ${region.currency} · alta ${date(t.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={t.active ? "ok" : "danger"}>{t.active ? "Activo" : "Suspendido"}</Badge>
            <Link
              href={`/${t.slug}`}
              target="_blank"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-bg"
            >
              <ExternalLink className="size-4" aria-hidden /> Ver carta
            </Link>
            <form action={toggleTenantActive.bind(null, t.id, !t.active)}>
              <button
                className={cn(
                  "h-10 rounded-xl px-3 text-sm font-medium",
                  t.active ? "border border-danger/40 text-danger hover:bg-danger-soft" : "bg-ok text-white",
                )}
              >
                {t.active ? "Suspender" : "Reactivar"}
              </button>
            </form>
          </div>
        }
      />
      {typeof ok === "string" && (
        <div className="mb-5">
          <FormSuccess message={ok} />
        </div>
      )}

      {/* Uso */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mesas cobradas (30 días)" value={String(u.sessions)} hint={`${u.guests} comensales`} />
        <Stat label="Facturación (30 días)" value={money(u.revenue)} hint={u.sessions ? `ticket promedio ${money(isRoundCurrency(region.currency) ? Math.round(u.revenue / u.sessions / 100) * 100 : Math.round(u.revenue / u.sessions))}` : "sin ventas"} />
        <Stat label="Carta y salón" value={`${u.products} platos`} hint={`${u.tables} mesas en ${u.areas} ${u.areas === 1 ? "salón" : "salones"}`} />
        <Stat
          label="Última mesa abierta"
          value={u.lastSession ? date(u.lastSession) : "—"}
          hint={`${u.bookings} reservas y ${u.purchases} compras en 30 días`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Módulos y plan */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Módulos</h2>
            <p className="text-sm text-muted">
              Plan: <strong className="text-ink">{plan ? plan.label : "a medida"}</strong>
            </p>
          </div>
          <ul className="divide-y divide-line">
            {MODULES.map((m) => {
              const row = enabled.get(m.key);
              const on = !!row?.enabled;
              const expired = detail.expiredModules.includes(m.key);
              return (
                <li key={m.key} className="flex flex-wrap items-center gap-3 py-3">
                  <form action={toggleModule.bind(null, t.id, m.key, !on)}>
                    <button
                      aria-pressed={on}
                      aria-label={`${on ? "Desactivar" : "Activar"} ${m.label}`}
                      className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand" : "bg-ink/15")}
                    >
                      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {m.label}
                      {expired && <span className="ml-2 text-xs font-normal text-danger">vencido</span>}
                    </p>
                    <p className="text-xs text-muted">{m.description}</p>
                  </div>
                  {on && (
                    <form action={setModuleExpiry.bind(null, t.id, m.key)} className="flex items-center gap-1.5 text-xs">
                      <label className="text-muted" htmlFor={`exp-${m.key}`}>
                        Vence
                      </label>
                      <input
                        id={`exp-${m.key}`}
                        type="date"
                        name="expiresAt"
                        defaultValue={row?.expiresAt ? row.expiresAt.toISOString().slice(0, 10) : ""}
                        className="h-8 rounded-lg border border-line bg-surface px-2"
                      />
                      <button className="h-8 rounded-lg border border-line px-2 hover:bg-ink/5">Guardar</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium">Aplicar un plan</p>
            <div className="flex flex-wrap gap-2">
              {PLANS.map((p) => (
                <form key={p.id} action={applyPlan.bind(null, t.id, p.id)}>
                  <button
                    title={p.description}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      plan?.id === p.id ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-ink/30",
                    )}
                  >
                    {p.label}
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Deja el local con los módulos del plan. Vacío en &ldquo;Vence&rdquo; = sin vencimiento.</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Datos</h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Dirección" value={t.settings?.address} />
              <Row label="Teléfono" value={t.settings?.phone} />
              <Row label="Zona horaria" value={region.timezone} />
              <Row label="Web" value={t.settings?.websiteUrl} />
              <Row label="Instagram" value={t.settings?.instagramUrl} />
            </dl>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Personal ({t.memberships.filter((m) => m.active).length} activos)</h2>
            <ul className="divide-y divide-line text-sm">
              {t.memberships.map((m) => (
                <li key={m.id} className={cn("py-1.5", !m.active && "text-muted line-through")}>
                  <span className="font-medium">{m.user.name}</span>
                  <span className="block text-xs text-muted">
                    {sortRoles(rolesOf(m))
                      .map((r) => ROLE_LABEL[r])
                      .join(" · ")}
                    {m.user.email && ` · ${m.user.email}`}
                    {m.pinHash && " · PIN"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right">{value || "—"}</dd>
    </div>
  );
}
