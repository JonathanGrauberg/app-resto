"use client";

import { useState, useTransition } from "react";
import { Check, HandPlatter, ReceiptText, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import { itemPhase, PHASE_LABEL } from "@/lib/item-status";
import { groupByPerson } from "@/lib/people";
import type { SalaSession } from "@/lib/sala";
import { acceptOrder, rejectOrder } from "@/app/staff/sala-actions";
import { deliverItems } from "@/app/staff/kds-actions";

const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

/**
 * Pedidos de la mesa para el personal:
 * 1) Pedidos nuevos por aceptar (cada envío desde la mesa), con quién pidió qué.
 * 2) Consumo de la mesa por persona, con el estado de cada plato y lo que suma cada uno.
 * El personal sí ve importes.
 */
export function OrdersSection({ session, onDone }: { session: SalaSession; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const toAccept = session.orders.filter((o) => o.status === "PENDING");
  const consumed = session.orders
    .filter((o) => o.status !== "PENDING")
    .flatMap((o) => o.items.map((i) => ({ ...i, phase: itemPhase(o.status, i.status) })));
  const total = consumed.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
  const readyIds = consumed.filter((i) => i.phase === "ready").map((i) => i.id);

  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      const res = await fn();
      setError(res?.error ?? null);
      if (!res?.error) {
        setRejecting(null);
        setReason("");
        onDone();
      }
    });

  if (session.orders.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
        <p className="flex items-center gap-2 font-medium text-ink">
          <ReceiptText className="size-4" aria-hidden /> Pedidos
        </p>
        <p className="mt-0.5">Todavía no pidieron. Lo que pidan desde el QR aparece acá al instante.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* 1) Por aceptar */}
      {toAccept.map((o) => (
        <div key={o.id} className="rounded-xl border border-danger/50 bg-danger-soft/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Pedido nuevo
              <span className="ml-2 text-xs font-normal text-muted">
                {time(o.createdAt)}
                {o.source === "STAFF" && " · cargado por el mozo"}
              </span>
            </p>
            <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-medium text-white">Por aceptar</span>
          </div>
          <PeopleList items={o.items} />

          {rejecting === o.id ? (
            <div className="mt-3 space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional): ej. se agotó la merluza"
                maxLength={140}
                className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => setRejecting(null)} className="flex-1 rounded-lg py-2 text-sm hover:bg-ink/5">
                  Volver
                </button>
                <button
                  onClick={() => run(() => rejectOrder(o.id, reason))}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-danger py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Rechazar pedido
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setRejecting(o.id)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-ink/5"
              >
                <X className="size-4" aria-hidden /> Rechazar
              </button>
              <button
                onClick={() => run(() => acceptOrder(o.id))}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ok py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Check className="size-4" aria-hidden /> Aceptar y enviar a cocina
              </button>
            </div>
          )}
        </div>
      ))}

      {readyIds.length > 0 && (
        <button
          onClick={() => run(() => deliverItems(readyIds))}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ok py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <HandPlatter className="size-4" aria-hidden /> Entregué lo listo ({readyIds.length})
        </button>
      )}

      {/* 2) Consumo de la mesa */}
      {consumed.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ReceiptText className="size-4" aria-hidden /> Consumo de la mesa
            </p>
            <p className="text-sm font-semibold tabular-nums">{formatPrice(total)}</p>
          </div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {groupByPerson(consumed).map((g) => (
              <div key={g.label} className="p-3">
                <p className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  {g.label}
                  <span className="font-normal normal-case tabular-nums">
                    {formatPrice(g.items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0))}
                  </span>
                </p>
                <ul className="space-y-1.5 text-sm">
                  {g.items.map((i) => {
                    const ph = PHASE_LABEL[i.phase];
                    return (
                      <li key={i.id} className="flex items-start gap-2">
                        <span className="w-6 shrink-0 font-semibold tabular-nums">{i.quantity}×</span>
                        <span className="min-w-0 flex-1">
                          {i.name}
                          {i.modifiers.length > 0 && <span className="block text-xs text-muted">{i.modifiers.join(", ")}</span>}
                          {i.notes && <span className="block text-xs italic text-warn">“{i.notes}”</span>}
                        </span>
                        {i.phase === "ready" ? (
                          <button
                            onClick={() => run(() => deliverItems([i.id]))}
                            disabled={pending}
                            className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", ph.className)}
                            title="Marcar como entregado"
                          >
                            {ph.label} · Entregar
                          </button>
                        ) : (
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", ph.className)}>{ph.label}</span>
                        )}
                        <span className="w-16 shrink-0 text-right tabular-nums text-muted">
                          {formatPrice(i.unitPriceCents * i.quantity)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

/** Ítems de un pedido nuevo, agrupados por persona. */
function PeopleList({ items }: { items: SalaSession["orders"][number]["items"] }) {
  return (
    <div className="space-y-2">
      {groupByPerson(items).map((g) => (
        <div key={g.label}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
          <ul className="mt-0.5 space-y-1 text-sm">
            {g.items.map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="w-6 shrink-0 font-semibold tabular-nums">{i.quantity}×</span>
                <span className="min-w-0 flex-1">
                  {i.name}
                  {i.modifiers.length > 0 && <span className="block text-xs text-muted">{i.modifiers.join(", ")}</span>}
                  {i.notes && <span className="block text-xs italic text-warn">“{i.notes}”</span>}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatPrice(i.unitPriceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
