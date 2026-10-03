"use client";

import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/field";
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
      <div className="sm:col-span-2">
        <Label htmlFor="ownerPassword">Contraseña inicial</Label>
        <Input id="ownerPassword" name="ownerPassword" type="password" minLength={8} autoComplete="new-password" required />
      </div>
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
