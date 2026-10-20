"use client";

import { Button } from "@/components/ui/button";
import { FormError, Input, Label, Select } from "@/components/ui/field";
import { COUNTRIES } from "@/lib/region";
import { PLANS } from "@/lib/plans";
import { createTenant } from "./actions";
import { useFormAction } from "@/lib/use-form-action";

export function CreateTenantForm() {
  const [state, action, pending] = useFormAction(createTenant, undefined);

  return (
    <form onSubmit={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="name">Nombre del local</Label>
        <Input id="name" name="name" placeholder="Bar El Faro" required />
      </div>
      <div>
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input id="slug" name="slug" placeholder="el-faro" autoCapitalize="none" required />
      </div>
      <div>
        <Label htmlFor="ownerName">Nombre del dueño</Label>
        <Input id="ownerName" name="ownerName" required />
      </div>
      <div>
        <Label htmlFor="ownerEmail">Email del dueño</Label>
        <Input id="ownerEmail" name="ownerEmail" type="email" required />
      </div>
      <div>
        <Label htmlFor="country">País</Label>
        <Select id="country" name="country" defaultValue="ES">
          {Object.entries(COUNTRIES).map(([code, c]) => (
            <option key={code} value={code}>
              {c.label} · {c.currency}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="ownerPassword">Contraseña inicial</Label>
        <Input id="ownerPassword" name="ownerPassword" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Plan inicial</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLANS.map((p, i) => (
            <label
              key={p.id}
              className="cursor-pointer rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input type="radio" name="plan" value={p.id} defaultChecked={i === PLANS.length - 1} className="sr-only" />
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className="block text-xs text-muted">{p.description}</span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Después se puede ajustar módulo por módulo desde la ficha del local.</p>
      </fieldset>
      <div className="space-y-3 sm:col-span-2">
        <FormError message={state?.error} />
        {state?.ok && <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{state.ok}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear local"}
        </Button>
      </div>
    </form>
  );
}
