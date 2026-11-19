"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, KeyRound, QrCode, Trash2 } from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Switch } from "@/components/ui/field";
import { newPairing, pairHere, removeDevice, removeStaffPassword, saveStaffPassword } from "./actions";

/** Botón que genera el QR de vinculación y lo muestra en grande. */
export function PairQrButton({ venue, minutes }: { venue: string; minutes: number }) {
  const [path, setPath] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => start(async () => setPath((await newPairing()).path))} disabled={pending}>
        <QrCode className="size-4" aria-hidden /> {pending ? "Generando…" : "QR para vincular un equipo"}
      </Button>
      {path && (
        <QrDialog
          path={path}
          title="Vincular equipo"
          venue={venue}
          caption={`Escanealo con el celular o tablet que va a usar el personal. Sirve una vez y vence en ${minutes} minutos.`}
          onClose={() => setPath(null)}
        />
      )}
    </>
  );
}

/** Vincular el equipo actual (el que tiene abierto el panel). */
export function PairHereForm() {
  const [state, action, pending] = useActionState(pairHere, undefined);
  return (
    <Card className="p-4 sm:p-5">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Field label="Vincular este equipo" htmlFor="name" hint="Si el personal va a usar esta misma compu o tablet." className="min-w-56 flex-1">
          <Input id="name" name="name" required maxLength={40} placeholder="Tablet caja" autoComplete="off" />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Vinculando…" : "Vincular"}
        </Button>
      </form>
      <div className="mt-3 empty:hidden">
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
      </div>
    </Card>
  );
}

export function RemoveDeviceButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Quitar ${name}`}
      onClick={() => {
        if (confirm(`¿Quitar "${name}"? Desde ese equipo ya no se va a poder entrar con PIN y se cierran las sesiones abiertas.`)) {
          start(() => removeDevice(id));
        }
      }}
      className="text-danger"
    >
      <Trash2 className="size-4" aria-hidden /> Quitar
    </Button>
  );
}

/**
 * Usuario y clave del local: el personal entra una vez con esto en su equipo y después solo con PIN.
 * El usuario es el código del local; la clave la elige el encargado.
 */
export function StaffPasswordCard({ slug, hasPassword, loginUrl }: { slug: string; hasPassword: boolean; loginUrl: string }) {
  const [state, action, pending] = useActionState(saveStaffPassword, undefined);
  const [editing, setEditing] = useState(!hasPassword);
  const [copied, setCopied] = useState(false);
  const [removing, startRemove] = useTransition();
  // Al guardar con éxito se cierra el formulario (ajuste de estado durante el render).
  const [handled, setHandled] = useState<typeof state>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) setEditing(false);
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Usuario y clave del local</p>
          <p className="text-sm text-muted">
            Lo más simple: cada uno entra una vez desde su celular en <strong>{loginUrl}</strong> con estos datos, y desde ahí entra solo con su PIN.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm">
        <span className="text-muted">Usuario del local:</span>
        <code className="font-semibold">{slug}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(slug).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand hover:bg-brand-soft"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copiado" : "Copiar"}
        </button>
        <span className="ml-auto text-muted">Clave: {hasPassword ? "creada" : "sin crear"}</span>
      </div>

      {editing ? (
        <form action={action} className="space-y-3">
          <Field
            label={hasPassword ? "Nueva clave del local" : "Clave del local"}
            htmlFor="staff-password"
            hint="Mínimo 6 caracteres. Es para el equipo, no para una persona: cada uno sigue entrando con su PIN."
          >
            <Input id="staff-password" name="password" required minLength={6} maxLength={100} autoComplete="new-password" />
          </Field>
          {hasPassword && (
            <Switch
              name="unpairAll"
              label="Desvincular todos los equipos"
              description="Si se fue alguien del personal: todos vuelven a entrar con la clave nueva."
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar clave"}
            </Button>
            {hasPassword && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Cambiar clave
          </Button>
          <Button
            variant="ghost"
            className="text-danger"
            disabled={removing}
            onClick={() => {
              if (confirm("¿Quitar la clave del local? Los equipos ya vinculados siguen andando; los nuevos solo se van a poder sumar con el QR.")) {
                startRemove(() => removeStaffPassword());
              }
            }}
          >
            Quitar clave
          </Button>
        </div>
      )}
      <div className="empty:hidden">
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
      </div>
    </Card>
  );
}
