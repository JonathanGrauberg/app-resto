"use client";

import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select, Switch } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import { handOver } from "./actions";

type Summary = { menu: string; tables: string; branding: string; settings: string; staff: string; always: string[] };

/** Formulario de entrega: datos del dueño, plan con meses gratis y qué se conserva de lo cargado. */
export function HandOverForm({
  tenantId,
  slug,
  plans,
  defaultPlan,
  defaultTrial,
  defaultPhone,
  demoOwners,
  summary,
}: {
  tenantId: string;
  slug: string;
  plans: { id: string; label: string }[];
  defaultPlan: string;
  defaultTrial: string;
  defaultPhone: string;
  demoOwners: string[];
  summary: Summary;
}) {
  const [state, action, pending] = useFormAction(handOver.bind(null, tenantId), undefined);
  const [confirm, setConfirm] = useState("");
  const err = state?.fieldErrors ?? {};

  return (
    <form onSubmit={action} className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">El dueño</h2>
        <p className="-mt-2 text-sm text-muted">Que lo completen ellos. Si el email ya tiene cuenta en Yatay, entra con su contraseña de siempre.</p>
        <Field label="Nombre" htmlFor="h-name" error={err.ownerName}>
          <Input id="h-name" name="ownerName" autoComplete="off" required />
        </Field>
        <Field label="Email" htmlFor="h-email" error={err.ownerEmail}>
          <Input id="h-email" name="ownerEmail" type="email" autoComplete="off" required />
        </Field>
        <Field label="Contraseña" htmlFor="h-pass" hint="Mínimo 8 caracteres. Nadie más la ve." error={err.ownerPassword}>
          <Input id="h-pass" name="ownerPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field label="WhatsApp" htmlFor="h-phone" hint="Opcional, para contactarlos" error={err.phone}>
          <Input id="h-phone" name="phone" type="tel" defaultValue={defaultPhone} autoComplete="off" />
        </Field>

        <h2 className="pt-2 font-semibold">Plan</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan" htmlFor="h-plan">
            <Select id="h-plan" name="planId" defaultValue={defaultPlan}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gratis hasta" htmlFor="h-trial" hint="Por defecto, 3 meses" error={err.trialUntil}>
            <Input id="h-trial" name="trialUntil" type="date" defaultValue={defaultTrial} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Qué se conserva</h2>
        <Switch name="keepMenu" defaultChecked label="Carta" description={summary.menu} />
        <Switch name="keepTables" defaultChecked label="Mesas y salones" description={summary.tables} />
        <Switch
          name="keepBranding"
          defaultChecked
          label="Imagen del local"
          description={`Logo, portada, textos, redes y página de enlaces. ${summary.branding}`}
        />
        <Switch name="keepSettings" defaultChecked label="Ajustes" description={summary.settings} />
        <Switch name="keepStaff" label="Personal" description={`${summary.staff}. Apagado: empiezan solo con el dueño.`} />

        <div className="rounded-xl bg-ink/5 p-3 text-sm">
          <p className="font-medium">Siempre se borra</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
            <li>Movimientos de prueba{summary.always.length ? `: ${summary.always.join(", ")}` : " (no hay)"}</li>
            <li>Equipos vinculados y sesiones abiertas, incluida la tuya en ese local</li>
            <li>{demoOwners.length ? `El dueño de la demo (${demoOwners.join(", ")})` : "Dueños anteriores"}</li>
          </ul>
        </div>

        <Field label={`Para confirmar, escribí "${slug}"`} htmlFor="h-confirm" error={err.confirm}>
          <Input
            id="h-confirm"
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <FormError message={state?.error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending || confirm.trim().toLowerCase() !== slug}>
          <PackageCheck className="size-5" aria-hidden /> {pending ? "Entregando…" : "Entregar local"}
        </Button>
        <p className="text-center text-xs text-muted">No se puede deshacer.</p>
      </Card>
    </form>
  );
}
