"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { FormError } from "@/components/ui/field";
import { RULES, type RulesKind } from "@/lib/muro/filter";
import { joinMuro } from "@/app/[slug]/muro/actions";

/** Antes de escribir: apodo, confirmar +18 y aceptar las reglas (si no, no se puede participar). */
export function JoinGate({
  slug,
  title,
  subtitle,
  kind = "wall",
  defaultName = "",
}: {
  slug: string;
  title: string;
  subtitle: string;
  kind?: RulesKind;
  /** Apodo que ya usa en la mesa (si pidió desde el QR), para no escribirlo de nuevo. */
  defaultName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [adult, setAdult] = useState(false);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await joinMuro(slug, name, adult, rules);
          if (res.error) return setError(res.error);
          router.refresh();
        });
      }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">¿Cómo querés aparecer?</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu apodo (ej. Juan, La Tía Marta)"
          maxLength={20}
          required
          autoComplete="nickname"
          className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base"
        />
      </label>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-brand" aria-hidden /> {kind === "wall" ? "Reglas del muro" : "Reglas del chat"}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {RULES[kind].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
        Soy mayor de 18 años.
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
        Leí y acepto las reglas. Sé que los mensajes que no las respeten se borran y que el local me puede bloquear.
      </label>

      <FormError message={error} />
      <button
        type="submit"
        disabled={pending || !adult || !rules || name.trim().length < 2}
        className="h-14 w-full rounded-full bg-ink text-base font-semibold text-bg disabled:opacity-40"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
