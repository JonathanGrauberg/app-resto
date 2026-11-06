"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { ProCrown } from "@/components/pro-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { PLANS, PRO_CODE_VALIDITY, PRO_PLAN_ID } from "@/lib/plans";
import { useFormAction } from "@/lib/use-form-action";
import { generateCode } from "./actions";

type Venue = { id: string; name: string; phone: string | null };

/** Generar un código PRO después de cerrar la venta, y mandarlo por WhatsApp. */
export function CodeForm({ venues }: { venues: Venue[] }) {
  const [state, action, pending] = useFormAction(generateCode, undefined);
  const [venueId, setVenueId] = useState("");
  const [validity, setValidity] = useState<number>(60);
  const [copied, setCopied] = useState<number | null>(null);

  const venue = venues.find((v) => v.id === venueId);
  const validLabel = PRO_CODE_VALIDITY.find((v) => v.minutes === validity)?.label ?? "";
  const message = state?.code
    ? `¡Bienvenidos a Yatay PRO! 👑\nTu código: ${state.code}\n\nEntrá a ${typeof window === "undefined" ? "" : window.location.origin}/login con tu email y contraseña, tocá "Ingresar código PRO" y pegalo. Vence en ${validLabel} y sirve una sola vez.`
    : "";
  const waTo = venue?.phone?.replace(/\D/g, "") ?? "";

  return (
    <Card className="p-5">
      <form onSubmit={action} className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan" htmlFor="c-plan">
          <Select id="c-plan" name="planId" defaultValue={PRO_PLAN_ID}>
            {PLANS.filter((p) => p.id !== "carta").map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duración" htmlFor="c-duration" hint="VIP = sin cargo y sin vencimiento">
          <Select id="c-duration" name="duration" defaultValue="1">
            {[1, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mes" : "meses"}
              </option>
            ))}
            <option value="vip">VIP (sin vencimiento)</option>
          </Select>
        </Field>
        <Field label="Para qué local" htmlFor="c-tenant" hint="Si elegís uno, solo ese local lo puede usar">
          <Select id="c-tenant" name="tenantId" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">Cualquiera (todavía no se registró)</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vence si no se usa en" htmlFor="c-valid">
          <Select id="c-valid" name="validMinutes" value={validity} onChange={(e) => setValidity(Number(e.target.value))}>
            {PRO_CODE_VALIDITY.map((v) => (
              <option key={v.minutes} value={v.minutes}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nota" htmlFor="c-note" hint="Solo la ven ustedes (ej. cerró Mariano, 3 meses a $X)" className="sm:col-span-2">
          <Input id="c-note" name="note" maxLength={120} />
        </Field>
        <div className="sm:col-span-2">
          <FormError message={state?.error} />
          <Button type="submit" disabled={pending} className="w-full !bg-[#fcc107] !text-[#1a1714] hover:!bg-[#f0b400] sm:w-auto">
            <ProCrown className="[&_path]:stroke-[#1a1714]" /> {pending ? "Generando…" : "Generar código PRO"}
          </Button>
        </div>
      </form>

      {state?.code && (
        <div className="mt-5 rounded-2xl bg-[#1a1714] p-5 text-center text-[#fcc107]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Código PRO · se ve una sola vez</p>
          <p className="mt-2 select-all font-mono text-3xl font-bold tracking-widest sm:text-4xl">{state.code}</p>
          <p className="mt-1 text-sm text-white/70">Vence en {validLabel}. Si se pierde, generá otro.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(message).then(() => setCopied(state.at ?? 0))}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
            >
              {copied === state.at ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied === state.at ? "Mensaje copiado" : "Copiar mensaje"}
            </button>
            <a
              href={`https://wa.me/${waTo}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#25d366] px-4 text-sm font-medium text-[#0b2e17] hover:brightness-105"
            >
              <MessageCircle className="size-4" aria-hidden /> {waTo ? `Mandar a ${venue?.name}` : "Mandar por WhatsApp"}
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}
