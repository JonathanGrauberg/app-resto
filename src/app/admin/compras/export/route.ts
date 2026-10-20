import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { localParts } from "@/lib/booking";
import { PURCHASE_CATEGORY_LABEL } from "@/lib/purchase-labels";
import { periodOf, purchaseSummary, type PeriodKind } from "@/lib/purchases";
import { getRegion } from "@/lib/region-server";

/**
 * Compras del período en CSV para Excel / Google Sheets: separador ";" y coma decimal,
 * con BOM para que Excel respete las tildes. Al final, el resumen vendido vs comprado.
 */
export async function GET(request: Request) {
  const { tdb, tenant } = await requireTenantRole(ADMIN_ROLES, "COMPRAS");
  const region = await getRegion(tenant.id);
  const url = new URL(request.url);
  const kind: PeriodKind = url.searchParams.get("periodo") === "mes" ? "mes" : "semana";
  const p = periodOf(kind, url.searchParams.get("ref") ?? undefined, region.timezone, region.locale);
  const s = await purchaseSummary(tdb, p.from, p.to);

  const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const cell = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Fecha", "Concepto", "Cantidad", "Proveedor", "Categoría", `Total (${region.currency})`].map(cell).join(";"),
    ...s.purchases.map((x) =>
      [
        cell(localParts(x.date, region.timezone).date),
        cell(x.item),
        cell(x.quantity),
        cell(x.supplier),
        cell(PURCHASE_CATEGORY_LABEL[x.category]),
        money(x.amountCents),
      ].join(";"),
    ),
    "",
    [cell("Período"), cell(p.label)].join(";"),
    [cell("Vendido (cobrado en caja, sin propinas)"), money(s.soldCents)].join(";"),
    [cell("Comprado"), money(s.purchasedCents)].join(";"),
    [cell("Resultado"), money(s.resultCents)].join(";"),
  ];

  return new Response("﻿" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compras-${tenant.slug}-${p.start}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
