"use client";

import { useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Switch } from "@/components/ui/field";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { useFormAction } from "@/lib/use-form-action";
import { saveStaff } from "./actions";

export type StaffValues = {
  id?: string;
  name: string;
  role: Role;
  email: string;
  hasPassword: boolean;
  hasPin: boolean;
  active: boolean;
};

const ROLE_HINT: Record<Role, string> = {
  OWNER: "Todo, incluida la configuración y el plan",
  ADMIN: "Carta, mesas, personal y ajustes",
  CAJA: "Cobros, cierre de mesas y gestión de mozos",
  MOZO: "Sus mesas y pedidos",
  COCINA: "Pantalla de cocina",
  BAR: "Pantalla de barra",
};

const PANEL_ROLES: Role[] = ["OWNER", "ADMIN", "CAJA"];

export function StaffForm({ values, roles, isSelf }: { values: StaffValues; roles: Role[]; isSelf: boolean }) {
  const [state, action, pending] = useFormAction(saveStaff.bind(null, values.id ?? null), undefined);
  const [role, setRole] = useState<Role>(values.role);
  const fe = state?.fieldErrors ?? {};
  const needsPassword = PANEL_ROLES.includes(role);

  return (
    <form onSubmit={action} className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="space-y-6">
        <Card className="space-y-4 p-4 sm:p-6">
          <Field label="Nombre" htmlFor="name" hint="Como aparece en la pantalla de PIN y en las mesas" error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name} required maxLength={40} />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Rol</legend>
            {isSelf && <p className="mb-2 text-xs text-muted">No podés cambiar tu propio rol.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <label
                  key={r}
                  className="cursor-pointer rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    disabled={isSelf && r !== values.role}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium">{ROLE_LABEL[r]}</span>
                  <span className="block text-xs text-muted">{ROLE_HINT[r]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="size-4" aria-hidden /> Acceso con PIN
            </h2>
            <p className="text-sm text-muted">
              Para dispositivos compartidos (tablet de cocina, celular de sala). Único dentro del local.
            </p>
          </div>
          <Field
            label={values.hasPin ? "Nuevo PIN" : "PIN"}
            htmlFor="pin"
            hint={values.hasPin ? "Ya tiene PIN. Dejalo vacío para mantenerlo." : "4 a 6 dígitos"}
            error={fe.pin}
          >
            <Input id="pin" name="pin" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="off" className="max-w-40 tracking-[0.3em]" />
          </Field>
        </Card>

        <Card className="space-y-4 p-4 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Mail className="size-4" aria-hidden /> Acceso con email
            </h2>
            <p className="text-sm text-muted">
              {needsPassword ? "Obligatorio para este rol: entra al panel." : "Opcional para este rol."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={fe.email}>
              <Input id="email" name="email" type="email" defaultValue={values.email} autoComplete="off" required={needsPassword} />
            </Field>
            <Field
              label={values.hasPassword ? "Nueva contraseña" : "Contraseña"}
              htmlFor="password"
              hint={values.hasPassword ? "Dejala vacía para mantenerla" : "Mínimo 8 caracteres"}
              error={fe.password}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required={needsPassword && !values.hasPassword}
              />
            </Field>
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-4 lg:sticky lg:top-8">
        <Switch
          name="active"
          defaultChecked={values.active}
          disabled={isSelf}
          label="Activo"
          description="Desactivado no puede entrar y se cierran sus sesiones"
        />
        {isSelf && <input type="hidden" name="active" value="on" />}
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <div className="flex gap-2">
          <ButtonLink href="/admin/personal" variant="secondary" className="flex-1">
            Volver
          </ButtonLink>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? "Guardando…" : values.id ? "Guardar" : "Dar de alta"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
