"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/field";
import { BILLING_LABEL, BILLING_TONE, PAYMENT_METHODS, type BillingState } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";
import { formatMoney, isRoundCurrency, type Region } from "@/lib/region";
import { useFormAction } from "@/lib/use-form-action";
import { deletePayment, registerPayment, saveSubscription, setSubscriptionCancelled } from "../../billing-actions";

type Sub = { planId: string | null; priceCents: number; trialEndsAt: string | null; paidUntil: string | null; notes: string | null; cancelled: boolean } | null;
type Pay = { id: string; amountCents: number; method: string; months: number; periodTo: string; paidAt: string; reference: string | null; recordedBy: string | null };

const day = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Precio en centavos → lo que se escribe en el campo ("25000" · "29,90"). */
const priceText = (cents: number, region: Region) =>
  cents ? (cents / 100).toLocaleString(region.locale, { useGrouping: false, minimumFractionDigits: isRoundCurrency(region.currency) ? 0 : 2 }) : "";

/** Cobro del local: estado, plan y precio, registrar pagos e historial. */
export function BillingCard({ tenantId, region, sub, state, payments, today }: { tenantId: string; region: Region; sub: Sub; state: BillingState; payments: Pay[]; today: string }) {
  const [subState, saveAction, saving] = useFormAction(saveSubscription.bind(null, tenantId), undefined);
  const [payState, payAction, paying] = useFormAction(registerPayment.bind(null, tenantId), undefined);
  const [months, setMonths] = useState(1);
  const money = (c: number) => formatMoney(c, region);
  const plan = PLANS.find((p) => p.id === sub?.planId);

  const status =
    state.kind === "active"
      ? `Pago hasta el ${day(state.until.toISOString())} · faltan ${state.daysLeft} días`
      : state.kind === "trial"
        ? `Prueba gratis hasta el ${day(state.until.toISOString())} · faltan ${state.daysLeft} días`
        : state.kind === "overdue"
          ? state.since
            ? `Venció el ${day(state.since.toISOString())} · hace ${state.days} días`
            : "Nunca pagó"
          : state.kind === "free"
            ? "No se le cobra (demo o cortesía)"
            : state.kind === "cancelled"
              ? "No se le cobra más"
              : "Cargá el plan y el precio para empezar a cobrarle";

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Suscripción</h2>
        <Badge tone={BILLING_TONE[state.kind]}>{BILLING_LABEL[state.kind]}</Badge>
      </div>
      <p className="text-sm text-muted">{status}</p>
      {sub && (
        <p className="mt-2 text-sm">
          {plan ? `Plan ${plan.label}` : "Sin plan"} · <strong>{sub.priceCents ? `${money(sub.priceCents)} por mes` : "sin precio"}</strong>
        </p>
      )}

      <details className="group mt-3 rounded-xl border border-line" open={!sub}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Plan, precio y prueba</summary>
        <form onSubmit={saveAction} className="space-y-3 border-t border-line p-3">
          <Field label="Plan" htmlFor="b-plan">
            <Select id="b-plan" name="planId" defaultValue={sub?.planId ?? ""}>
              <option value="">A medida</option>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Precio por mes (${region.currency})`} htmlFor="b-price" hint="0 = sin cargo (demo o cortesía)" error={subState?.fieldErrors?.price}>
            <Input id="b-price" name="price" inputMode="decimal" defaultValue={priceText(sub?.priceCents ?? 0, region) || "0"} />
          </Field>
          <Field label="Prueba gratis hasta" htmlFor="b-trial" hint="Vacío = sin prueba" error={subState?.fieldErrors?.trialEndsAt}>
            <Input id="b-trial" name="trialEndsAt" type="date" defaultValue={sub?.trialEndsAt?.slice(0, 10) ?? ""} />
          </Field>
          <Field label="Notas" htmlFor="b-notes" hint="Solo las ve el equipo (acuerdos, descuentos, contacto de pago)">
            <Textarea id="b-notes" name="notes" rows={2} defaultValue={sub?.notes ?? ""} />
          </Field>
          <FormError message={subState?.error} />
          <FormSuccess message={subState?.ok} />
          <Button type="submit" variant="secondary" className="w-full" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </details>

      {sub && !sub.cancelled && (
        <details className="mt-3 rounded-xl border border-line" open={state.kind === "overdue"}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Registrar un pago</summary>
          <form onSubmit={payAction} className="space-y-3 border-t border-line p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meses" htmlFor="p-months" error={payState?.fieldErrors?.months}>
                <Select id="p-months" name="months" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  {[1, 2, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>
                      {m} {m === 1 ? "mes" : "meses"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Monto (${region.currency})`} htmlFor="p-amount" error={payState?.fieldErrors?.amount}>
                <Input key={months} id="p-amount" name="amount" inputMode="decimal" defaultValue={priceText(sub.priceCents * months, region)} />
              </Field>
              <Field label="Medio" htmlFor="p-method">
                <Select id="p-method" name="method" defaultValue="TRANSFERENCIA">
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha" htmlFor="p-date" error={payState?.fieldErrors?.paidAt}>
                <Input id="p-date" name="paidAt" type="date" defaultValue={today} />
              </Field>
            </div>
            <Field label="Referencia" htmlFor="p-ref" hint="Nº de operación, comprobante… (opcional)">
              <Input id="p-ref" name="reference" />
            </Field>
            <FormError message={payState?.error} />
            <FormSuccess message={payState?.ok} />
            <Button type="submit" className="w-full" disabled={paying}>
              {paying ? "Registrando…" : "Registrar pago"}
            </Button>
          </form>
        </details>
      )}

      {payments.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">Pagos</p>
          <ul className="divide-y divide-line text-sm">
            {payments.map((p, i) => (
              <li key={p.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p>
                    <strong className="tabular-nums">{money(p.amountCents)}</strong> · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}
                  </p>
                  <p className="text-xs text-muted">
                    {day(p.paidAt)} · {p.months} {p.months === 1 ? "mes" : "meses"}, hasta el {day(p.periodTo)}
                    {p.reference && ` · ${p.reference}`}
                    {p.recordedBy && ` · cargó ${p.recordedBy}`}
                  </p>
                </div>
                {i === 0 && (
                  <form action={deletePayment.bind(null, tenantId, p.id)}>
                    <button aria-label="Borrar este pago (cargado por error)" title="Borrar (cargado por error)" className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sub && (
        <form action={setSubscriptionCancelled.bind(null, tenantId, !sub.cancelled)} className="mt-3 border-t border-line pt-3">
          <button className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
            {sub.cancelled ? "Reactivar la suscripción" : "Dar de baja la suscripción (deja de cobrarse)"}
          </button>
        </form>
      )}
    </Card>
  );
}
