"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChefHat, Clock, Flame, RotateCcw, Wine } from "lucide-react";
import { cn } from "@/lib/format";
import type { KdsOrder } from "@/lib/kds";
import { readyItems, startItems, undoReady } from "@/app/staff/kds-actions";
import { elapsed, useNow } from "@/components/sala/sala-utils";

type Column = "new" | "cooking" | "ready";

function columnOf(o: KdsOrder): Column {
  if (o.items.every((i) => i.status === "READY")) return "ready";
  if (o.items.every((i) => i.status === "PENDING")) return "new";
  return "cooking";
}

const COLUMNS: { id: Column; title: string; empty: string }[] = [
  { id: "new", title: "Nuevos", empty: "Sin pedidos nuevos" },
  { id: "cooking", title: "En preparación", empty: "Nada en el fuego" },
  { id: "ready", title: "¡Listos! · esperando al mozo", empty: "Nada esperando" },
];

/** Minutos desde que el mozo aceptó: ámbar a los 10, rojo a los 20. */
function urgency(fromIso: string, now: number | null) {
  if (now === null) return "";
  const min = (now - new Date(fromIso).getTime()) / 60_000;
  if (min >= 20) return "ring-2 ring-danger";
  if (min >= 10) return "ring-2 ring-warn";
  return "";
}

export function KdsBoard({
  orders,
  station,
  single = false,
}: {
  orders: KdsOrder[];
  station: "KITCHEN" | "BAR";
  /** Local con una sola pantalla: cocina recibe también lo de barra. */
  single?: boolean;
}) {
  const now = useNow(20_000);
  const Icon = station === "BAR" ? Wine : ChefHat;
  const byColumn = (c: Column) => orders.filter((o) => columnOf(o) === c);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon className="size-7" aria-hidden /> {station === "BAR" ? "Barra" : "Cocina"}
        </h1>
        {single && <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Comidas y bebidas</span>}
        <span className="text-sm text-muted">
          {orders.length === 1 ? "1 pedido activo" : `${orders.length} pedidos activos`} · se actualiza solo
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = byColumn(col.id);
          return (
            <section key={col.id} className="min-h-40 rounded-2xl bg-ink/[0.03] p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold uppercase tracking-wider text-muted">
                {col.title}
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs tabular-nums text-ink">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.length === 0 && <p className="px-1 py-6 text-center text-sm text-muted">{col.empty}</p>}
                {list.map((o) => (
                  <Ticket key={o.id} order={o} column={col.id} now={now} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ticket({ order: o, column, now }: { order: KdsOrder; column: Column; now: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      const res = await fn();
      setError(res?.error ?? null);
      router.refresh();
    });
  const notReady = o.items.filter((i) => i.status !== "READY").map((i) => i.id);
  const readySince = o.items.map((i) => i.readyAt).filter(Boolean).sort()[0];

  return (
    <article
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-sm transition-opacity",
        column !== "ready" && urgency(o.acceptedAt, now),
        pending && "opacity-60",
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-3xl font-black leading-none">Mesa {o.tableLabel}</p>
          {o.waiterName && <p className="mt-1 text-xs text-muted">Mozo: {o.waiterName}</p>}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-sm font-semibold tabular-nums">
          <Clock className="size-4" aria-hidden />
          {column === "ready" && readySince ? elapsed(readySince, now) : elapsed(o.acceptedAt, now)}
        </span>
      </header>

      <ul className="space-y-2">
        {o.items.map((i) => (
          <li key={i.id} className={cn("flex items-start gap-3", i.status === "READY" && column !== "ready" && "opacity-50")}>
            <span className="w-9 shrink-0 text-2xl font-black tabular-nums">{i.quantity}×</span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-lg font-semibold leading-tight", i.status === "READY" && column !== "ready" && "line-through")}>
                {i.name}
              </p>
              {i.modifiers.length > 0 && <p className="text-sm text-brand">{i.modifiers.join(" · ")}</p>}
              {i.notes && (
                <p className="mt-0.5 rounded-md bg-warn-soft px-2 py-0.5 text-sm font-medium text-warn">⚠ {i.notes}</p>
              )}
            </div>
            {column === "cooking" && i.status !== "READY" && (
              <button
                onClick={() => run(() => readyItems([i.id]))}
                disabled={pending}
                aria-label={`Marcar ${i.name} como listo`}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ok/50 text-ok hover:bg-ok-soft"
              >
                <Check className="size-5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      <footer className="mt-4 flex gap-2">
        {column === "new" && (
          <>
            <button
              onClick={() => run(() => startItems(o.items.map((i) => i.id)))}
              disabled={pending}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-brand-ink"
            >
              <Flame className="size-5" aria-hidden /> Empezar
            </button>
            <button
              onClick={() => run(() => readyItems(notReady))}
              disabled={pending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-ink/5"
            >
              Ya está listo
            </button>
          </>
        )}
        {column === "cooking" && (
          <button
            onClick={() => run(() => readyItems(notReady))}
            disabled={pending || notReady.length === 0}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ok text-base font-semibold text-white"
          >
            <Check className="size-5" aria-hidden /> ¡Todo listo!
          </button>
        )}
        {column === "ready" && (
          <button
            onClick={() => run(() => undoReady(o.items.map((i) => i.id)))}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm text-muted hover:bg-ink/5"
          >
            <RotateCcw className="size-4" aria-hidden /> Deshacer
          </button>
        )}
      </footer>
      {error && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </article>
  );
}
