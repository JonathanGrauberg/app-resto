import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { recentProCodes } from "@/lib/pro";
import { CodeForm } from "./code-form";
import { voidCode } from "./actions";

export const metadata: Metadata = { title: "Códigos PRO" };

const fmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Códigos PRO: se generan después de cerrar una venta y el local los ingresa para activar su plan. */
export default async function ProCodesPage() {
  await requirePlatformAdmin();
  const [codes, tenants] = await Promise.all([
    recentProCodes(),
    db.tenant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, subscription: { select: { contactPhone: true } } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Códigos PRO"
        description="Cuando un local quiere el Pro (hasta tener Mercado Pago): cierran la venta, generan un código y se lo mandan. Lo ingresa al iniciar sesión, al registrarse o en “Tu plan”."
      />
      <CodeForm venues={tenants.map((t) => ({ id: t.id, name: t.name, phone: t.subscription?.contactPhone ?? null }))} />

      <h2 className="mb-3 mt-8 font-semibold">Últimos códigos</h2>
      <Card className="divide-y divide-line">
        {codes.length === 0 && <p className="p-4 text-sm text-muted">Todavía no generaron ninguno.</p>}
        {codes.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm sm:p-4">
            <Badge tone={c.status === "used" ? "ok" : c.status === "valid" ? "brand" : "neutral"}>
              {c.status === "used" ? "Usado" : c.status === "valid" ? "Vigente" : "Vencido"}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {c.plan} · {c.vip ? "VIP" : `${c.months} ${c.months === 1 ? "mes" : "meses"}`}
                {c.forTenant && <span className="font-normal text-muted"> · solo para {c.forTenant}</span>}
              </p>
              <p className="text-muted">
                {c.status === "used"
                  ? `Lo usó ${c.usedBy} el ${fmt.format(c.usedAt!)}`
                  : c.status === "valid"
                    ? `Vence ${fmt.format(c.expiresAt)}`
                    : `Venció ${fmt.format(c.expiresAt)}`}
                {` · generó ${c.createdBy ?? "—"} el ${fmt.format(c.createdAt)}`}
                {c.note && ` · ${c.note}`}
              </p>
            </div>
            {c.status === "valid" && (
              <form action={voidCode.bind(null, c.id)}>
                <button className="rounded-lg px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft">Anular</button>
              </form>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
