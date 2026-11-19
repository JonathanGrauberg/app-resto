"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input } from "@/components/ui/field";
import { loginWithVenue } from "../actions";

/**
 * Este navegador todavía no está vinculado al local: se entra una vez con el usuario del local
 * y la clave del local, y desde ahí alcanza con el PIN. (También sirve el QR de Personal → Equipos.)
 */
export function NotPaired({ venue, slug }: { venue?: string; slug?: string }) {
  const [state, action, pending] = useActionState(loginWithVenue, undefined);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Store className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold">{venue ? `Entrar a ${venue}` : "Entrar al local"}</h1>
          <p className="mt-1 text-sm text-muted">Se hace una sola vez en este equipo. Después entrás solo con tu PIN.</p>
        </div>

        <form action={action} className="mt-5 space-y-4">
          {slug ? (
            <input type="hidden" name="slug" value={slug} />
          ) : (
            <Field label="Usuario del local" htmlFor="slug" hint="Te lo pasa el encargado. Ej. gunda">
              <Input id="slug" name="slug" required autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
            </Field>
          )}
          <Field label="Clave del local" htmlFor="password">
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="¿Qué equipo es?" htmlFor="name" hint="Opcional, para reconocerlo en la lista. Ej. Celular de Juan, Tablet barra.">
            <Input id="name" name="name" maxLength={40} placeholder="Celular de Juan" autoComplete="off" />
          </Field>
          <FormError message={state?.error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-center text-sm text-muted">
          ¿Sos el encargado?{" "}
          <Link href="/login?next=/admin/personal/equipos" className="font-medium text-brand">
            Entrá con tu mail
          </Link>{" "}
          para crear o cambiar la clave del local.
        </p>
      </Card>
    </main>
  );
}
