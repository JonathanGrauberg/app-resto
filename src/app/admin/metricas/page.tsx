import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, Download, Wine } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { cn } from "@/lib/format";
import { PRESETS, getMetrics, metricsRange } from "@/lib/metrics";
import { formatMoney, isRoundCurrency } from "@/lib/region";
import { getRegion } from "@/lib/region-server";

export const metadata: Metadata = { title: "Métricas" };

const mins = (m: number | null) => {
  if (m === null) return "—";
  const r = Math.round(m);
  return r < 60 ? `${r} min` : `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, "0")}`;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const one = (x: number) => x.toLocaleString("es", { maximumFractionDigits: 1 });

/** Métricas del local: facturación, mesas, platos, mozos, horarios y tiempos de cocina. */
export default async function MetricasPage({ searchParams }: PageProps<"/admin/metricas">) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "BI");
  const region = await getRegion(tenant.id);
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const range = metricsRange({ preset: str(sp.periodo), desde: str(sp.desde), hasta: str(sp.hasta) }, region.timezone);
  const m = await getMetrics(tdb, range.start, range.end, region.timezone);
  // Promedios: en monedas sin centavos (pesos) se redondean a la unidad.
  const money = (c: number) => formatMoney(isRoundCurrency(region.currency) ? Math.round(c / 100) * 100 : Math.round(c), region);
  const qs = `desde=${range.from}&hasta=${range.to}`;
  const fmtDate = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(region.locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const s = m.summary;

  // Horas con movimiento (sin los extremos vacíos), para que el gráfico no sea todo huecos.
  // Siempre de 11 a 23 como mínimo, así se ve el día completo aunque solo haya cenas.
  const active = m.byHour.filter((h) => h.sessions > 0);
  const hours = active.length ? m.byHour.slice(Math.min(11, active[0].hour), Math.max(23, active[active.length - 1].hour) + 1) : [];
  const maxHour = Math.max(1, ...hours.map((h) => h.revenue));
  const maxWeekday = Math.max(1, ...m.byWeekday.map((d) => d.avgPerDay));
  const topProducts = m.byProduct.slice(0, 12);
  const maxProduct = Math.max(1, ...topProducts.map((p) => p.revenue));
  const productTotal = m.byProduct.reduce((n, p) => n + p.revenue, 0);

  return (
    <>
      <PageHeader
        title="Métricas"
        description={`Mesas cobradas del ${fmtDate(range.from)} al ${fmtDate(range.to)}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {[
              { tipo: "productos", label: "Platos" },
              { tipo: "mesas", label: "Mesas" },
              { tipo: "mozos", label: "Mozos" },
            ].map((x) => (
              <a
                key={x.tipo}
                href={`/admin/metricas/export?tipo=${x.tipo}&${qs}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-bg"
              >
                <Download className="size-4" aria-hidden /> {x.label}
              </a>
            ))}
          </div>
        }
      />

      {/* Filtros: una sola fila arriba de todo */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Período">
          {PRESETS.map((p) => (
            <Link
              key={p.id}
              href={`/admin/metricas?periodo=${p.id}`}
              role="tab"
              aria-selected={range.preset === p.id}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                range.preset === p.id ? "bg-surface shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/admin/metricas">
          <input type="date" name="desde" defaultValue={range.from} aria-label="Desde" className="h-9 rounded-lg border border-line bg-surface px-2" />
          <span className="text-muted">a</span>
          <input type="date" name="hasta" defaultValue={range.to} aria-label="Hasta" className="h-9 rounded-lg border border-line bg-surface px-2" />
          <button className={cn("h-9 rounded-lg px-3 font-medium", range.preset ? "border border-line hover:bg-ink/5" : "bg-ink text-bg")}>Ver</button>
        </form>
      </div>

      {s.sessions === 0 ? (
        <Card className="p-10 text-center text-muted">No hay mesas cobradas en este período.</Card>
      ) : (
        <div className="space-y-8">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Facturación" value={money(s.revenue)} hint={`${one(s.tablesPerDay)} mesas por día de servicio`} />
            <Stat label="Mesas atendidas" value={String(s.sessions)} hint={`${s.guests} comensales · ${s.serviceDays} días con servicio`} />
            <Stat label="Ticket promedio" value={money(s.avgTicket)} hint={`${money(s.perGuest)} por comensal`} />
            <Stat label="Estadía promedio" value={mins(s.avgStay)} hint={s.tips ? `Propinas: ${money(s.tips)}` : "Sin propinas registradas"} />
          </div>

          {/* Horarios */}
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Facturación por hora de llegada</h2>
              <p className="mb-4 text-xs text-muted">Según la hora en que se abrió la mesa. Tocá o pasá el mouse por una barra para ver el detalle.</p>
              <div className="flex h-44 items-end gap-1 border-b border-line" role="img" aria-label="Facturación por hora de llegada">
                {hours.map((h) => (
                  <div key={h.hour} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    <div
                      className={cn("w-full max-w-7 rounded-t-[4px] bg-brand transition-opacity group-hover:opacity-80", h.revenue > 0 && "min-h-[2px]")}
                      style={{ height: `${(h.revenue / maxHour) * 100}%` }}
                    />
                    <Tip>
                      <strong>{String(h.hour).padStart(2, "0")}:00</strong> · {h.sessions} {h.sessions === 1 ? "mesa" : "mesas"} · {money(h.revenue)}
                    </Tip>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1 text-[10px] text-muted">
                {hours.map((h) => (
                  <span key={h.hour} className="flex-1 text-center tabular-nums">
                    {h.hour}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Promedio por día de la semana</h2>
              <p className="mb-4 text-xs text-muted">Facturación promedio de cada día con servicio.</p>
              <ul className="space-y-2">
                {m.byWeekday.map((d) => (
                  <li key={d.label} className="group relative grid grid-cols-[36px_1fr_auto] items-center gap-2 text-sm">
                    <span className="text-muted">{d.label}</span>
                    <span className="h-3 rounded-r-[4px] bg-ink/5">
                      <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${(d.avgPerDay / maxWeekday) * 100}%` }} />
                    </span>
                    <span className="w-24 text-right tabular-nums">{d.avgPerDay ? money(d.avgPerDay) : "—"}</span>
                    <Tip>
                      {d.label}: {d.sessions} mesas · total {money(d.revenue)}
                    </Tip>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Platos */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">Platos más vendidos</h2>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {m.categories.map((c) => (
                  <span key={c.category} className="rounded-full bg-ink/5 px-2.5 py-1">
                    {c.category} · <strong className="tabular-nums">{productTotal ? pct(c.revenue / productTotal) : "—"}</strong>
                  </span>
                ))}
              </div>
            </div>
            <Table
              head={["Plato", "Unidades", "Facturación", "% de lo vendido"]}
              rows={topProducts.map((p) => [
                <span key="n">
                  {p.name}
                  <span className="block text-xs text-muted">
                    {p.category}
                    {p.comped > 0 && ` · ${p.comped} invitados`}
                  </span>
                </span>,
                p.quantity,
                money(p.revenue),
                <span key="b" className="flex items-center justify-end gap-2">
                  <span className="hidden h-2 w-24 rounded-r-[4px] bg-ink/5 sm:block">
                    <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${(p.revenue / maxProduct) * 100}%` }} />
                  </span>
                  <span className="w-10 tabular-nums">{productTotal ? pct(p.revenue / productTotal) : "—"}</span>
                </span>,
              ])}
            />
            {m.byProduct.length > topProducts.length && (
              <p className="mt-2 text-xs text-muted">
                Se muestran los {topProducts.length} que más facturaron de {m.byProduct.length}. El detalle completo está en “Platos” (exportar).
              </p>
            )}
          </Card>

          <div className="grid gap-4 2xl:grid-cols-2">
            {/* Mozos */}
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-semibold">Por mozo</h2>
              <Table
                head={["Mozo", "Mesas", "Comensales", "Facturación", "Ticket prom.", "Propinas"]}
                rows={m.byWaiter.map((w) => [w.name, w.sessions, w.guests, money(w.revenue), money(w.avgTicket), w.tips ? money(w.tips) : "—"])}
              />
            </Card>

            {/* Cocina y barra */}
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold">Tiempos de cocina y barra</h2>
              <p className="mb-3 text-xs text-muted">Desde que el mozo acepta el pedido hasta que el plato está listo.</p>
              {m.kitchen.kitchenCount + m.kitchen.barCount === 0 ? (
                <p className="text-sm text-muted">Todavía no hay platos marcados como listos desde las pantallas de cocina o barra.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <MiniStat icon={<ChefHat className="size-4" aria-hidden />} label="Cocina" value={mins(m.kitchen.kitchenAvg)} hint={`${m.kitchen.kitchenCount} platos`} />
                    <MiniStat icon={<Wine className="size-4" aria-hidden />} label="Barra" value={mins(m.kitchen.barAvg)} hint={`${m.kitchen.barCount} bebidas`} />
                    <MiniStat label="Listo → en la mesa" value={mins(m.kitchen.deliverAvg)} hint="lo que tarda el mozo" />
                  </div>
                  {m.kitchen.slowest.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-4 text-sm font-medium">Los que más tardan</p>
                      <ul className="divide-y divide-line text-sm">
                        {m.kitchen.slowest.map((p) => (
                          <li key={p.name} className="flex justify-between py-1.5">
                            <span>
                              {p.name} <span className="text-xs text-muted">· {p.count} veces</span>
                            </span>
                            <span className="tabular-nums">{mins(p.avg)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* Mesas */}
          <Card className="p-4 sm:p-5">
            <h2 className="font-semibold">Por mesa</h2>
            <p className="mb-3 text-xs text-muted">
              Rotación: veces que se ocupó por día de servicio. Ocupación: parte del horario de servicio (de la primera mesa abierta a la
              última cobrada de cada día) en que estuvo ocupada; lo que falta hasta el 100% es tiempo ociosa.
            </p>
            <Table
              head={["Mesa", "Ocupaciones", "Rotación / día", "Estadía prom.", "Ocupación", "Facturación", "Por comensal"]}
              rows={m.byTable.map((t) => [
                t.label,
                t.sessions,
                one(t.perDay),
                mins(t.avgStay),
                <span key="o" className="flex items-center justify-end gap-2">
                  <span className="hidden h-2 w-16 rounded-r-[4px] bg-ink/5 sm:block">
                    <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${Math.min(1, t.occupancy) * 100}%` }} />
                  </span>
                  <span className="w-10 tabular-nums">{pct(t.occupancy)}</span>
                </span>,
                money(t.revenue),
                money(t.guests ? t.revenue / t.guests : 0),
              ])}
            />
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function MiniStat({ icon, label, value, hint }: { icon?: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-ink/5 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}

/** Detalle al pasar el mouse (o tocar) una marca del gráfico. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-lg group-hover:block">
      {children}
    </span>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={h} className={cn("py-2 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={cn("py-2", ci > 0 && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
