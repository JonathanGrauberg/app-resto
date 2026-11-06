"use client";

import { useActionState, useState, useTransition } from "react";
import { QrCode, Trash2 } from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import { newPairing, pairHere, removeDevice } from "./actions";

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
