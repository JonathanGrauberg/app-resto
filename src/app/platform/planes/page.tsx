import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/format";
import { MODULES } from "@/lib/modules";
import { PLANS } from "@/lib/plans";
import { plansUsage } from "@/lib/platform";

export const metadata: Metadata = { title: "Planes" };

/** Qué incluye cada plan y cuántos locales tiene cada uno. Los precios se definen más adelante. */
export default async function PlansPage() {
  await requirePlatformAdmin();
  const count = await plansUsage();

  return (
    <>
      <PageHeader title="Planes" description="Combinaciones de módulos para dar de alta un local. En cada local se puede ajustar módulo por módulo." />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">{p.label}</h2>
              <span className="text-sm text-muted">{count.get(p.id) ?? 0} locales</span>
            </div>
            <p className="mt-1 text-sm text-muted">{p.description}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {MODULES.map((m) => {
                const inc = p.modules.includes(m.key);
                return (
                  <li key={m.key} className={cn("flex items-start gap-2", !inc && "text-muted/60")}>
                    {inc ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Incluido" /> : <Minus className="mt-0.5 size-4 shrink-0" aria-label="No incluido" />}
                    {m.label}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        {count.get("medida") ? `${count.get("medida")} locales tienen una combinación a medida. ` : ""}
        Los planes se editan en <code className="rounded bg-ink/5 px-1">src/lib/plans.ts</code>. Los precios y el cobro de la suscripción
        quedan para la etapa de cobro del SaaS.
      </p>
    </>
  );
}
