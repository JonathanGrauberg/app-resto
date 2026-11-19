"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Switch } from "@/components/ui/field";
import { saveStaffAccountAction } from "./staff-account-actions";

/**
 * Cuenta del personal: un usuario y contraseña para las compus, tablets y celulares del local.
 * Se entra con eso en /login y después cada uno pone su PIN.
 */
export function StaffAccountCard({
  username,
  hasPassword,
  suggested,
  loginUrl,
}: {
  username: string | null;
  hasPassword: boolean;
  suggested: string;
  loginUrl: string;
}) {
  const [state, action, pending] = useActionState(saveStaffAccountAction, undefined);
  const created = !!username && hasPassword;
  const [editing, setEditing] = useState(!created);
  // Al guardar con éxito se cierra el formulario (ajuste de estado durante el render).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setEditing(false);
  }
  const fe = state?.fieldErrors ?? {};

  return (
    <Card className="mb-6 space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Cuenta del personal</p>
          <p className="text-sm text-muted">
            Para las compus, tablets y celulares del local. Se entra en <strong>{loginUrl}</strong> con este usuario y contraseña, y después cada
            uno pone su PIN.
          </p>
        </div>
      </div>

      {created && !editing && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-bg px-3 py-2.5 text-sm">
          <span>
            <span className="text-muted">Usuario: </span>
            <code className="font-semibold">{username}</code>
          </span>
          <span>
            <span className="text-muted">Contraseña: </span>la que elegiste
          </span>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEditing(true)}>
            Cambiar
          </Button>
        </div>
      )}

      {editing && (
        <form action={action} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Usuario" htmlFor="staff-username" error={fe.username}>
              <Input
                id="staff-username"
                name="username"
                defaultValue={username ?? suggested}
                required
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <Field
              label={created ? "Contraseña nueva" : "Contraseña"}
              htmlFor="staff-password"
              hint={created ? "Dejala vacía para no cambiarla." : "Mínimo 6 caracteres."}
              error={fe.password}
            >
              <Input id="staff-password" name="password" type="text" maxLength={100} autoComplete="off" spellCheck={false} required={!created} />
            </Field>
          </div>
          {created && (
            <Switch
              name="unpairAll"
              label="Cerrar en todos los equipos"
              description="Si se fue alguien: todas las compus y tablets vuelven a pedir usuario y contraseña."
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : created ? "Guardar" : "Crear cuenta del personal"}
            </Button>
            {created && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      <div className="empty:hidden">
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
      </div>
    </Card>
  );
}
