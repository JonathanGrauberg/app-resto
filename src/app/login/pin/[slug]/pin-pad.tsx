"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { Delete } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { loginWithPin } from "../../actions";

type Person = { id: string; name: string; roleLabel: string };

export function PinPad({ slug, people }: { slug: string; people: Person[] }) {
  const [state, action, pending] = useActionState(loginWithPin, undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  if (!selected) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand"
          >
            <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">
              {p.name.charAt(0)}
            </span>
            <span className="block font-medium leading-tight">{p.name}</span>
            <span className="text-xs text-muted">{p.roleLabel}</span>
          </button>
        ))}
      </div>
    );
  }

  const person = people.find((p) => p.id === selected)!;

  return (
    <Card className="p-5">
      <form action={action} className="space-y-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="membershipId" value={selected} />
        <input type="hidden" name="pin" value={pin} />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{person.name}</p>
            <p className="text-xs text-muted">{person.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setPin("");
            }}
            className="text-sm text-brand"
          >
            Cambiar
          </button>
        </div>

        <div className="flex justify-center gap-3" aria-label={`${pin.length} dígitos ingresados`}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={cn("size-4 rounded-full border-2 border-ink/30", i < pin.length && "border-brand bg-brand")}
            />
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
    </Card>
  );
}

function PadKey({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 items-center justify-center rounded-xl bg-bg text-xl font-medium active:bg-ink/10",
        className,
      )}
      {...props}
    />
  );
}
