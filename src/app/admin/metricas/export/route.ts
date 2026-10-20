import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { getMetrics, metricsRange } from "@/lib/metrics";
import { getRegion } from "@/lib/region-server";

/** Métricas en CSV para Excel (";" y coma decimal, con BOM): platos, mesas o mozos. */
export async function GET(request: Request) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "BI");
  const region = await getRegion(tenant.id);
  const url = new URL(request.url);
  const range = metricsRange(
    { preset: url.searchParams.get("periodo") ?? undefined, desde: url.searchParams.get("desde") ?? undefined, hasta: url.searchParams.get("hasta") ?? undefined },
    region.timezone,
  );
  const m = await getMetrics(tdb, range.start, range.end, region.timezone);
  const tipo = url.searchParams.get("tipo") ?? "productos";

  const num = (x: number, d = 2) => x.toFixed(d).replace(".", ",");
  const money = (cents: number) => num(cents / 100);
  const cell = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);
  const cur = region.currency;

  let head: string[];
  let rows: (string | number)[][];
  if (tipo === "mesas") {
    head = ["Mesa", "Ocupaciones", "Rotación por día", "Estadía promedio (min)", "Ocupación (%)", `Facturación (${cur})`, "Comensales"];
    rows = m.byTable.map((t) => [t.label, t.sessions, num(t.perDay, 1), Math.round(t.avgStay), Math.round(t.occupancy * 100), money(t.revenue), t.guests]);
  } else if (tipo === "mozos") {
    head = ["Mozo", "Mesas", "Comensales", `Facturación (${cur})`, `Ticket promedio (${cur})`, `Propinas (${cur})`, "Estadía promedio (min)"];
    rows = m.byWaiter.map((w) => [w.name, w.sessions, w.guests, money(w.revenue), money(w.avgTicket), money(w.tips), Math.round(w.avgStay)]);
  } else {
    head = ["Plato", "Categoría", "Unidades", "Invitados", `Facturación (${cur})`];
    rows = m.byProduct.map((p) => [p.name, p.category, p.quantity, p.comped, money(p.revenue)]);
  }

  const lines = [
    `${cell("Período")};${cell(`${range.from} a ${range.to}`)}`,
    "",
    head.map((h) => cell(h)).join(";"),
    // Los números ya formateados ("12,50") van sin comillas para que Excel los tome como número.
    ...rows.map((r) => r.map((v) => (typeof v === "string" && /^-?\d+(,\d+)?$/.test(v) ? v : cell(v))).join(";")),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metricas-${tipo}-${tenant.slug}-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
