"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { pairDevice } from "./actions";

export function PairForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(pairDevice.bind(null, token), undefined);
  return (
    <form action={action} className="mt-5 space-y-4">
      <Field label="¿Qué equipo es?" htmlFor="name" hint="Para reconocerlo en la lista. Ej. Celular de Juan, Tablet barra.">
        <Input id="name" name="name" required maxLength={40} placeholder="Celular de Juan" autoComplete="off" />
      </Field>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Vinculando…" : "Vincular y entrar con PIN"}
      </Button>
    </form>
  );
}
