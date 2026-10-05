"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LockKeyholeOpen, Vault } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { openShift } from "@/app/staff/caja/shift-actions";

/** Estado del turno de caja: abrir con efectivo inicial, o resumen rápido + cerrar. */
export function ShiftBar({
  shift,
}: {
  shift: { id: string; openedAt: string; salesCents: number; tipsCents: number; expectedCashCents: number; tables: number } | null;
}) {
  const router = useRouter();
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!shift) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await openShift(cash);
            if (res?.error) return setError(res.error);
            setError(null);
            router.refresh();
          });
        }}
        className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/40 bg-warn-soft p-4"
      >
        <Vault className="size-6 text-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Caja sin turno abierto</p>
          <p className="text-sm text-muted">Abrí el turno con el efectivo que hay en el cajón para llevar el arqueo.</p>
        </div>
        <label className="relative">
          <span className="sr-only">Efectivo inicial</span>
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            inputMode="decimal"
            placeholder="Efectivo inicial"
            className="h-11 w-40 rounded-xl border border-line bg-surface pl-3 pr-7 text-base sm:text-sm"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
        </label>
        <button disabled={pending} className="h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-bg disabled:opacity-50">
          Abrir turno
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
      <span className="flex items-center gap-2 font-semibold">
        <LockKeyholeOpen className="size-5 text-ok" aria-hidden />
        Turno abierto desde {new Date(shift.openedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span>
        <span className="text-muted">Cobrado</span> <strong className="tabular-nums">{formatPrice(shift.salesCents)}</strong>
        <span className="text-muted"> · {shift.tables} {shift.tables === 1 ? "mesa" : "mesas"}</span>
      </span>
      {shift.tipsCents > 0 && (
        <span>
          <span className="text-muted">Propinas</span> <strong className="tabular-nums">{formatPrice(shift.tipsCents)}</strong>
        </span>
      )}
      <span>
        <span className="text-muted">Efectivo en cajón</span>{" "}
        <strong className="tabular-nums">{formatPrice(shift.expectedCashCents)}</strong>
      </span>
      <Link
        href={`/staff/caja/turno/${shift.id}`}
        className="ml-auto inline-flex h-10 items-center rounded-xl border border-line px-4 font-medium hover:bg-ink/5"
      >
        Cerrar turno / arqueo
      </Link>
    </div>
  );
}
