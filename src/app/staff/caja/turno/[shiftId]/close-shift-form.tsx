"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { closeShift } from "../../shift-actions";

/** Arqueo: contar el efectivo del cajón y cerrar el turno. Muestra la diferencia antes de confirmar. */
export function CloseShiftForm({ shiftId, expectedCents }: { shiftId: string; expectedCents: number }) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = Number(counted.replace(/\s|€/g, "").replace(",", "."));
  const countedCents = counted && Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  const diff = countedCents == null ? null : countedCents - expectedCents;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm("¿Cerrar el turno? Después no se puede modificar.")) return;
        start(async () => {
          const res = await closeShift(shiftId, counted, notes);
          if (res?.error) return setError(res.error);
          router.refresh();
        });
      }}
      className="space-y-3 print:hidden"
    >
      <h2 className="text-sm font-semibold">Cerrar turno</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Efectivo contado en el cajón
          <span className="relative mt-1 block">
            <input
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              inputMode="decimal"
              required
              placeholder={(expectedCents / 100).toFixed(2).replace(".", ",")}
              className="h-11 w-full rounded-xl border border-line bg-surface pl-3 pr-7 text-base sm:text-sm"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
          </span>
        </label>
        <div className="flex items-end">
          {diff !== null && (
            <p
              className={
                diff === 0
                  ? "w-full rounded-xl bg-ok-soft px-3 py-2.5 text-sm font-medium text-ok"
                  : "w-full rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
              }
            >
              {diff === 0 ? "Cuadra perfecto" : `${diff > 0 ? "Sobra" : "Falta"} ${formatPrice(Math.abs(diff))}`}
            </p>
          )}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Notas (opcional): ej. faltan 5 € por un cambio mal dado"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base sm:text-sm"
      />
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <button disabled={pending} className="h-12 w-full rounded-xl bg-ink font-semibold text-bg disabled:opacity-50">
        {pending ? "Cerrando…" : "Cerrar turno"}
      </button>
    </form>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-ink/5"
    >
      <Printer className="size-4" aria-hidden /> Imprimir resumen
    </button>
  );
}
