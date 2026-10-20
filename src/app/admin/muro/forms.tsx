"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QrDialog } from "@/components/qr-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import { createChatGroup, createWall, saveBlockedWords } from "./actions";

export function NewWallForm() {
  const router = useRouter();
  const [state, action, pending] = useFormAction(async (prev: Parameters<typeof createWall>[0], fd: FormData) => {
    const res = (await createWall(prev, fd)) as (Awaited<ReturnType<typeof createWall>> & { id?: string }) | undefined;
    if (res?.id) router.push(`/admin/muro/${res.id}`);
    return res;
  }, undefined);
  const fe = state?.fieldErrors ?? {};
  const today = new Date().toLocaleDateString("sv-SE");

  return (
    <Card className="p-4">
      <form onSubmit={action} className="space-y-3">
        <h2 className="font-semibold">Nuevo muro de evento</h2>
        <Field label="Evento" htmlFor="w-name" error={fe.name}>
          <Input id="w-name" name="name" placeholder="Despedida de soltero de Juan" required maxLength={60} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Día" htmlFor="w-date" error={fe.date} className="col-span-3">
            <Input id="w-date" name="date" type="date" defaultValue={today} required />
          </Field>
          <Field label="Desde" htmlFor="w-from" error={fe.from} className="col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
            <Input id="w-from" name="from" type="time" defaultValue="21:00" required />
          </Field>
          <Field label="Hasta" htmlFor="w-to" error={fe.to} className="col-span-3 sm:col-span-1 lg:col-span-3 xl:col-span-1">
            <Input id="w-to" name="to" type="time" defaultValue="03:00" required />
          </Field>
        </div>
        <Field label="Moderación" htmlFor="w-mod" hint="Siempre con filtro de palabras; el local puede borrar cualquier mensaje.">
          <Select id="w-mod" name="moderation" defaultValue="AUTO">
            <option value="AUTO">Salen directo a la pantalla</option>
            <option value="APPROVE">El local aprueba cada mensaje</option>
          </Select>
        </Field>
        <FormError message={state?.error} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creando…" : "Crear muro"}
        </Button>
      </form>
    </Card>
  );
}

/** Grupo de chat suelto (sin mesa), por ejemplo para un evento en la barra. */
export function NewGroup({ slug, venue }: { slug: string; venue: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [qr, setQr] = useState<{ code: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createChatGroup(name);
            if (res?.error || !res?.code) return setError(res?.error ?? "No se pudo crear");
            setError(null);
            setQr({ code: res.code, name });
            setName("");
            router.refresh();
          });
        }}
        className="space-y-2"
      >
        <h2 className="font-semibold">Grupo de chat suelto</h2>
        <p className="text-xs text-muted">Para grupos de mesa, usá &ldquo;Armar grupo de chat&rdquo; desde la mesa en Sala.</p>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Los de la barra" maxLength={40} aria-label="Nombre del grupo" />
          <Button type="submit" variant="secondary" disabled={pending || name.trim().length < 2}>
            Crear
          </Button>
        </div>
        <FormError message={error} />
      </form>
      {qr && <QrDialog path={`/${slug}/chat/${qr.code}`} title={qr.name} venue={venue} caption="Escaneá para sumarte al chat de la mesa (+18)" onClose={() => setQr(null)} />}
    </Card>
  );
}

export function BlockedWordsForm({ words }: { words: string[] }) {
  const [state, action, pending] = useFormAction(saveBlockedWords, undefined);
  return (
    <Card className="p-4">
      <form onSubmit={action} className="space-y-2">
        <h2 className="font-semibold">Palabras no permitidas del local</h2>
        <p className="text-xs text-muted">
          Se suman a la lista general (insultos comunes de tu país, teléfonos y usuarios de redes). Separalas con coma o una por línea.
        </p>
        <Textarea name="words" rows={3} defaultValue={words.join(", ")} placeholder="ej. apodos de la competencia, nombres del personal" />
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Guardar palabras"}
        </Button>
      </form>
    </Card>
  );
}
