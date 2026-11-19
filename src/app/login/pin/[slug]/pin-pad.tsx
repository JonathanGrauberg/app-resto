"use client";

import { useActionState, useEffect, useRef, useState, type ComponentProps } from "react";
import { Delete } from "lucide-react";
import { Photo } from "@/components/mock-image";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { leaveVenue, loginWithPin } from "../../actions";

/**
 * Solo el PIN: se escribe con los botones o con el teclado de la compu (números, borrar, Enter).
 * El PIN dice quién entra (dueño, mozo, cocina…); no hace falta elegir la persona.
 */
export function PinPad({ slug, venue, logoUrl }: { slug: string; venue: string; logoUrl: string | null }) {
  const [state, action, pending] = useActionState(loginWithPin, undefined);
  const [pin, setPin] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Tras un PIN incorrecto se limpia para escribir de nuevo (ajuste de estado durante el render).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.error) setPin("");
  }

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  // Teclado físico (compu del local): números, Backspace, Escape y Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setPin("");
      // Se envía en el próximo tick, cuando ya se dibujó el último dígito tecleado.
      else if (e.key === "Enter") setTimeout(() => formRef.current?.requestSubmit(), 0);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Card className="p-5">
      <form ref={formRef} action={action} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="pin" value={pin} />

        <div className="flex flex-col items-center text-center">
          <Photo src={logoUrl} seed={slug} kind="kitchen" label={`Logo de ${venue}`} className="size-14 rounded-2xl ring-1 ring-ink/10" />
          <p className="mt-3 text-lg font-semibold">{venue}</p>
          <p className="text-sm text-muted">Ingresá tu PIN</p>
        </div>

        <div className="flex justify-center gap-3" aria-label={`${pin.length} dígitos ingresados`}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span key={i} className={cn("size-4 rounded-full border-2 border-ink/30", i < pin.length && "border-brand bg-brand")} />
          ))}
        </div>

        <FormError message={state?.error} />

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadKey key={d} onClick={() => press(d)}>
              {d}
            </PadKey>
          ))}
          <PadKey onClick={() => setPin("")} aria-label="Borrar todo" className="text-sm text-muted">
            C
          </PadKey>
          <PadKey onClick={() => press("0")}>0</PadKey>
          <PadKey onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Borrar">
            <Delete className="size-5" aria-hidden />
          </PadKey>
        </div>

        <button
          type="submit"
          disabled={pin.length < 4 || pending}
          className="h-13 w-full rounded-xl bg-brand font-medium text-brand-ink disabled:opacity-40"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <form action={leaveVenue.bind(null, slug)} className="mt-4 text-center">
        <button className="text-xs text-muted hover:text-ink">Salir de {venue} en este equipo</button>
      </form>
    </Card>
  );
}

function PadKey({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("flex h-14 items-center justify-center rounded-xl bg-bg text-xl font-medium active:bg-ink/10", className)}
      {...props}
    />
  );
}
