"use client";

import { useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import type { Receipt } from "@/lib/receipt";

type Mode = "persona" | "iguales" | "detalle";

/**
 * Dividir la cuenta:
 * - Por persona: lo que pidió cada uno (según el apodo con que pidió en la mesa).
 * - En partes iguales: total ÷ N, con el redondeo explicado.
 * - Detalle: lista única de lo consumido (platos repetidos sumados) y quién lo pidió.
 */
export function SplitBill({ receipt: r }: { receipt: Receipt }) {
  const hasPeople = r.people.length > 1;
  const [mode, setMode] = useState<Mode>(hasPeople ? "persona" : "iguales");
  const [n, setN] = useState(Math.max(1, r.guests));

  // Partes iguales en céntimos: el resto se reparte de a 1 céntimo para que la suma cierre exacta.
  const base = Math.floor(r.totalCents / n);
  const remainder = r.totalCents - base * n;

  const tabs: { id: Mode; label: string }[] = [
    ...(hasPeople ? [{ id: "persona" as const, label: "Cada uno lo suyo" }] : []),
    { id: "iguales", label: "Partes iguales" },
    { id: "detalle", label: "Detalle" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between rounded-2xl bg-surface p-4 ring-1 ring-line">
        <span className="text-sm text-muted">Total de la mesa</span>
        <span className="text-3xl font-bold tabular-nums">{formatPrice(r.totalCents)}</span>
      </div>

      <div className="flex rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Cómo dividir">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-sm font-medium",
              mode === t.id ? "bg-surface shadow-sm" : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "persona" && (
        <div className="space-y-3">
          {r.people.map((p) => (
            <details key={p.label} className="group rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <span className="font-semibold">{p.label}</span>
                <span className="text-lg font-bold tabular-nums">{formatPrice(p.totalCents)}</span>
              </summary>
              <ul className="space-y-1 border-t border-line px-4 py-3 text-sm">
                {p.items.map((i) => (
                  <li key={i.id} className="flex gap-2">
                    <span className="w-6 shrink-0 tabular-nums">{i.quantity}×</span>
                    <span className="min-w-0 flex-1">
                      {i.name}
                      {i.modifiers.length > 0 && <span className="block text-xs text-muted">{i.modifiers.join(", ")}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{formatPrice(i.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <p className="text-xs text-muted">
            Tocá un nombre para ver el detalle. Lo que cargó el mozo figura como &ldquo;Mesa&rdquo;; si algo fue para compartir,
            podés usar &ldquo;Partes iguales&rdquo; para esa parte.
          </p>
        </div>
      )}

      {mode === "iguales" && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <Users className="size-4" aria-hidden /> Entre
            </span>
            <div className="flex items-center rounded-xl border border-line">
              <button onClick={() => setN((v) => Math.max(1, v - 1))} className="p-3" aria-label="Una persona menos">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
                {n}
              </span>
              <button onClick={() => setN((v) => Math.min(50, v + 1))} className="p-3" aria-label="Una persona más">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <p className="text-center">
            <span className="block text-sm text-muted">Cada uno paga</span>
            <span className="text-4xl font-bold tabular-nums">{formatPrice(base + (remainder > 0 ? 1 : 0))}</span>
          </p>
          {remainder > 0 && (
            <p className="text-center text-xs text-muted">
              {remainder} {remainder === 1 ? "persona paga" : "personas pagan"} {formatPrice(base + 1)} y {n - remainder}{" "}
              {formatPrice(base)}, así suma exacto.
            </p>
          )}
        </div>
      )}

      {mode === "detalle" && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {r.lines.map((l) => (
            <li key={l.key} className="flex gap-2 px-4 py-3">
              <span className="w-7 shrink-0 font-semibold tabular-nums">{l.quantity}×</span>
              <span className="min-w-0 flex-1">
                {l.name}
                <span className="block text-xs text-muted">
                  {[...l.modifiers, l.people.join(", ")].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatPrice(l.totalCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
