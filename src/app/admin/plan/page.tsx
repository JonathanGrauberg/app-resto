import type { Metadata } from "next";
import Link from "next/link";
import { Check, MessageCircle, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ProBadge, ProCrown } from "@/components/pro-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { BRAND, salesWhatsApp } from "@/lib/brand";
import { cn } from "@/lib/format";
import { PLAN_FEATURES, planById, PRO_PLAN_ID, PUBLIC_PLAN_IDS } from "@/lib/plans";
import { tenantPlan } from "@/lib/pro";
import { RedeemForm } from "./redeem-form";

export const metadata: Metadata = { title: "Tu plan" };

const day = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const FIRST_STEPS = [
  { href: "/admin/carta", label: "Cargá tu carta", text: "Categorías, productos, fotos y precios." },
  { href: "/admin/mesas", label: "Armá tus mesas", text: "Y descargá los QR para imprimir." },
  { href: "/admin/enlaces", label: "Tu página de enlaces", text: "Instagram, WhatsApp, reseñas y cómo llegar." },
  { href: "/admin/ajustes", label: "Logo y datos del local", text: "Para que la carta se vea como tu local." },
];

/** Plan del local: qué tiene, cómo pasar a Pro y dónde ingresar el código PRO. */
export default async function PlanPage({ searchParams }: PageProps<"/admin/plan">) {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const { bienvenida, pro: proParam } = await searchParams;
  const { plan, state, vip, pro } = await tenantPlan(tenant.id);

  const status =
    state.kind === "vip"
      ? "VIP: sin vencimiento y sin cargo."
      : state.kind === "active"
        ? `Activo hasta el ${day(state.until)}.`
        : state.kind === "trial"
          ? `Prueba gratis hasta el ${day(state.until)}.`
          : state.kind === "overdue"
            ? "Vencido: escribinos para renovarlo."
            : state.kind === "cancelled"
              ? "Dado de baja."
              : "Sin vencimiento.";

  return (
    <>
      {bienvenida === "1" && (
        <Card className="mb-6 border-brand/30 bg-brand-soft/40 p-5">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <PartyPopper className="size-5 text-brand" aria-hidden /> ¡Bienvenido a {BRAND.name}! Tu local ya está creado.
          </p>
          <p className="mt-1 text-sm text-muted">
            Tu carta ya está en{" "}
            <Link href={`/${tenant.slug}`} className="font-medium text-brand underline">
              /{tenant.slug}
            </Link>
            . Para dejarla lista:
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {FIRST_STEPS.map((s, i) => (
              <Link key={s.href} href={s.href} className="flex gap-3 rounded-xl bg-surface p-3 ring-1 ring-line hover:ring-brand">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">{i + 1}</span>
                <span>
                  <span className="block font-medium">{s.label}</span>
                  <span className="text-sm text-muted">{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <PageHeader title={pro ? "Plan PRO" : "Tu plan"} description="Qué incluye tu plan y cómo pasar al siguiente." />
      {/* Resultado del código PRO ingresado al registrarse. */}
      {(proParam === "1" || proParam === "0") && (
        <p role="status" className={cn("mb-5 rounded-xl px-4 py-3 text-sm font-medium", proParam === "1" ? "bg-[#fcc107]/20 text-ink" : "bg-warn-soft text-warn")}>
          {proParam === "1"
            ? `¡Código activado! Ya tenés el plan ${plan?.label ?? "Pro"}.`
            : "Tu local quedó creado, pero el código PRO no sirvió (ya se usó o venció). Pedinos uno nuevo y ingresalo acá abajo."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className={cn("p-5 sm:p-6", pro && "ring-2 ring-[#fcc107]")}>
          <p className="text-sm text-muted">Tu plan actual</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{plan?.label ?? "Gratis"}</h2>
            {pro && <ProBadge vip={vip} size="lg" />}
          </div>
          <p className="mt-1 text-sm text-muted">{status}</p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {(PLAN_FEATURES[plan?.id ?? "carta"] ?? []).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="flex items-center gap-2 font-semibold">
            <ProCrown className="size-5" /> ¿Tenés un código PRO?
          </p>
          <p className="mb-4 mt-1 text-sm text-muted">Te lo damos cuando activás tu plan. Vence rápido: ingresalo apenas lo recibas.</p>
          <RedeemForm />
        </Card>
      </div>

      {!pro && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">Planes</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PUBLIC_PLAN_IDS.map((id) => {
              const p = planById(id)!;
              const current = p.id === (plan?.id ?? "carta");
              const isPro = p.id === PRO_PLAN_ID;
              const wa = salesWhatsApp(`Hola! Soy de ${tenant.name} (${tenant.slug}) y quiero el plan ${p.label} de ${BRAND.name}.`);
              return (
                <Card key={id} className={cn("flex flex-col p-5", isPro && "ring-2 ring-[#fcc107]")}>
                  <div className="flex items-center gap-2">
                    {isPro && <ProCrown className="size-5" />}
                    <h3 className="text-xl font-bold">{p.label}</h3>
                  </div>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    {(PLAN_FEATURES[id] ?? []).map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {current ? (
                      <p className="rounded-xl bg-ink/5 py-2.5 text-center text-sm font-medium text-muted">Tu plan</p>
                    ) : id === "carta" ? null : wa ? (
                      <ButtonLink href={wa} target="_blank" rel="noopener" className={cn("w-full", isPro && "!bg-[#fcc107] !text-[#1a1714] hover:!bg-[#f0b400]")}>
                        <MessageCircle className="size-4" aria-hidden /> Quiero el {p.label}
                      </ButtonLink>
                    ) : (
                      <p className="text-center text-sm text-muted">Pedile el código a tu contacto de {BRAND.name}.</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
