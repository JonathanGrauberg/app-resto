import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, Plus, Sparkles, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { BRAND } from "@/lib/brand";
import { MODULES } from "@/lib/modules";
import { billingThisMonth, sessionsPerDay, tenantsOverview, upcomingBookings } from "@/lib/platform";
import { COUNTRIES, formatMoney, regionOf } from "@/lib/region";

export const metadata: Metadata = { title: "Plataforma" };

const ago = (days: number | null) => (days === null ? "nunca" : days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`);

/** Resumen de la plataforma: locales, uso de todos y alertas. */
export default async function PlatformHome() {
  await requirePlatformAdmin();
  const tenants = await tenantsOverview();
  const [perDay, bookings, collected] = await Promise.all([sessionsPerDay(tenants), upcomingBookings(), billingThisMonth()]);

  const active = tenants.filter((t) => t.active);
  const newThisMonth = tenants.filter((t) => t.createdThisMonth).length;
  const sessions30 = tenants.reduce((n, t) => n + t.sessions30, 0);
  // Facturación procesada: por moneda (no se suman euros con pesos).
  const byCurrency = new Map<string, { cents: number; region: (typeof tenants)[number]["region"] }>();
  for (const t of tenants) {
    if (!t.revenue30) continue;
    const e = byCurrency.get(t.region.currency) ?? { cents: 0, region: t.region };
    e.cents += t.revenue30;
    byCurrency.set(t.region.currency, e);
  }
  const byCountry = Object.entries(COUNTRIES)
    .map(([code, c]) => ({ code, label: c.label, count: active.filter((t) => t.region.country === code).length }))
    .filter((c) => c.count);

  // Cobros de Yatay: ingreso mensual de los que están al día, por moneda.
  const mrr = new Map<string, number>();
  for (const t of active) if (t.billing.kind === "active") mrr.set(t.region.currency, (mrr.get(t.region.currency) ?? 0) + t.priceCents);
  const money = (cents: number, currency: string) => formatMoney(cents, regionOf({ country: currency === "EUR" ? "ES" : "AR", currency }));
  const paying = active.filter((t) => t.billing.kind === "active").length;
  const trials = active.filter((t) => t.billing.kind === "trial");
  const overdue = active.filter((t) => t.billing.kind === "overdue");
  const unset = active.filter((t) => t.billing.kind === "none");
  const toCollect = [
    ...overdue,
    ...trials.filter((t) => t.billing.kind === "trial" && t.billing.daysLeft <= 5),
    ...active.filter((t) => t.billing.kind === "active" && t.billing.daysLeft <= 5),
  ];

  // Alertas
  const idle = active.filter((t) => t.idle);
  const expiring = tenants.flatMap((t) => t.expiring.map((m) => ({ tenant: t, module: m.module, expiresAt: m.expiresAt! })));
  const fresh = tenants.filter((t) => t.fresh);
  const maxDay = Math.max(1, ...perDay.map((d) => d.sessions));
  const moduleLabel = (k: string) => MODULES.find((m) => m.key === k)?.label ?? k;

  return (
    <>
      <PageHeader
        title="Resumen"
        description="Cómo vienen todos los locales de la plataforma."
        actions={
          <ButtonLink href="/platform/locales/nuevo">
            <Plus className="size-4" aria-hidden /> Nuevo local
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Locales activos" value={`${active.length}`} hint={`${tenants.length - active.length} suspendidos · ${newThisMonth} nuevos este mes`} href="/platform/locales" />
        <Stat label="Mesas cobradas (30 días)" value={sessions30.toLocaleString("es")} hint={`${Math.round(sessions30 / 30)} por día en promedio`} />
        <Card className="p-4">
          <p className="text-sm text-muted">Facturación procesada (30 días)</p>
          {byCurrency.size === 0 ? (
            <p className="mt-1 text-2xl font-bold">—</p>
          ) : (
            [...byCurrency.values()].map((c) => (
              <p key={c.region.currency} className="mt-1 text-xl font-bold tabular-nums">
                {formatMoney(c.cents, c.region)}
              </p>
            ))
          )}
          <p className="text-xs text-muted">Lo que cobraron los locales (no es facturación de la plataforma)</p>
        </Card>
        <Stat label="Reservas próximas" value={`${bookings}`} hint="Confirmadas, próximos 7 días" />
      </div>

      <h2 className="mb-3 mt-6 flex items-center gap-2 font-semibold">
        <Wallet className="size-4" aria-hidden /> Cobros de {BRAND.name}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Ingreso mensual</p>
          {mrr.size === 0 ? (
            <p className="mt-1 text-2xl font-bold">—</p>
          ) : (
            [...mrr].map(([cur, cents]) => (
              <p key={cur} className="mt-1 text-xl font-bold tabular-nums">
                {money(cents, cur)}
              </p>
            ))
          )}
          <p className="text-xs text-muted">{paying === 1 ? "1 local al día" : `${paying} locales al día`}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Cobrado este mes</p>
          {collected.length === 0 ? (
            <p className="mt-1 text-2xl font-bold">—</p>
          ) : (
            collected.map((c) => (
              <p key={c.currency} className="mt-1 text-xl font-bold tabular-nums">
                {money(c.cents, c.currency)}
              </p>
            ))
          )}
          <p className="text-xs text-muted">{collected.reduce((n, c) => n + c.count, 0)} pagos registrados</p>
        </Card>
        <Stat label="En prueba gratis" value={`${trials.length}`} hint={unset.length ? `${unset.length} sin suscripción configurada` : "Todos los locales tienen suscripción"} />
        <Stat label="Pagos vencidos" value={`${overdue.length}`} hint={overdue.length ? "Revisalos abajo" : "Nadie debe nada"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Mesas cobradas por día</h2>
          <p className="mb-4 text-xs text-muted">Todos los locales, últimos 30 días. Tocá o pasá el mouse por una barra.</p>
          <div className="flex h-40 items-end gap-[3px] border-b border-line" role="img" aria-label="Mesas cobradas por día">
            {perDay.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                <div
                  className={`w-full max-w-5 rounded-t-[4px] bg-brand group-hover:opacity-80 ${d.sessions ? "min-h-[2px]" : ""}`}
                  style={{ height: `${(d.sessions / maxDay) * 100}%` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-lg group-hover:block">
                  {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} ·{" "}
                  <strong>{d.sessions}</strong> mesas
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted">
            <span>{new Date(`${perDay[0].date}T12:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
            <span>Hoy</span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">Locales por país</h2>
          {byCountry.length === 0 ? (
            <p className="text-sm text-muted">Sin locales activos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {byCountry.map((c) => (
                <li key={c.code} className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
                  <span>{c.label}</span>
                  <span className="h-3 rounded-r-[4px] bg-ink/5">
                    <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${(c.count / active.length) * 100}%` }} />
                  </span>
                  <span className="tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-6 font-semibold">Más activos (30 días)</h2>
          <ul className="divide-y divide-line text-sm">
            {[...active]
              .sort((a, b) => b.sessions30 - a.sessions30)
              .slice(0, 5)
              .map((t) => (
                <li key={t.id} className="flex justify-between py-1.5">
                  <Link href={`/platform/locales/${t.id}`} className="truncate hover:underline">
                    {t.name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted">{t.sessions30} mesas</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {/* Alertas */}
      <h2 className="mb-3 mt-8 font-semibold">Para revisar</h2>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <AlertCard icon={<Wallet className="size-4" aria-hidden />} title="Para cobrar (vencidos o vencen en 5 días)" empty="No hay cobros pendientes.">
          {toCollect.map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <Link href={`/platform/locales/${t.id}`} className="truncate hover:underline">
                {t.name}
              </Link>
              <span className={t.billing.kind === "overdue" ? "shrink-0 text-danger" : "shrink-0 text-muted"}>
                {t.billing.kind === "overdue"
                  ? t.billing.since
                    ? `venció hace ${t.billing.days} días`
                    : "nunca pagó"
                  : t.billing.kind === "trial"
                    ? `prueba: ${t.billing.daysLeft} días`
                    : t.billing.kind === "active"
                      ? `vence en ${t.billing.daysLeft} días`
                      : ""}
              </span>
            </li>
          ))}
        </AlertCard>
        <AlertCard icon={<Clock className="size-4" aria-hidden />} title="Sin actividad hace 7 días o más" empty="Todos los locales activos se usaron esta semana.">
          {idle.map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <Link href={`/platform/locales/${t.id}`} className="truncate hover:underline">
                {t.name}
              </Link>
              <span className="shrink-0 text-muted">{ago(t.lastUseDays)}</span>
            </li>
          ))}
        </AlertCard>
        <AlertCard icon={<AlertTriangle className="size-4" aria-hidden />} title="Módulos que vencen en 14 días" empty="No hay módulos por vencer.">
          {expiring.map((e) => (
            <li key={`${e.tenant.id}-${e.module}`} className="flex justify-between gap-2">
              <Link href={`/platform/locales/${e.tenant.id}`} className="truncate hover:underline">
                {e.tenant.name} · {moduleLabel(e.module)}
              </Link>
              <span className="shrink-0 text-muted">{e.expiresAt.toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
            </li>
          ))}
        </AlertCard>
        <AlertCard icon={<Sparkles className="size-4" aria-hidden />} title="Locales nuevos (7 días)" empty="Ningún alta esta semana.">
          {fresh.map((t) => (
            <li key={t.id} className="flex justify-between gap-2">
              <Link href={`/platform/locales/${t.id}`} className="truncate hover:underline">
                {t.name}
              </Link>
              <span className="shrink-0 text-muted">{t.products ? `${t.products} productos` : "sin carta todavía"}</span>
            </li>
          ))}
        </AlertCard>
      </div>
    </>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const card = (
    <Card className={href ? "h-full p-4 transition-colors hover:border-brand" : "h-full p-4"}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function AlertCard({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
        {children.length > 0 && <span className="rounded-full bg-warn-soft px-2 text-xs text-warn">{children.length}</span>}
      </p>
      {children.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="space-y-1.5 text-sm">{children}</ul>}
    </Card>
  );
}
