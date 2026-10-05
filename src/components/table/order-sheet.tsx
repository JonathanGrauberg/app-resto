"use client";

import { useEffect, useState, useTransition } from "react";
import { Minus, Plus, Send, X } from "lucide-react";
import { Photo } from "@/components/mock-image";
import { cn } from "@/lib/format";
import { itemPhase, PHASE_LABEL } from "@/lib/item-status";
import { groupByPerson, joinNames } from "@/lib/people";
import type { DinerTableState } from "@/lib/table-session";
import { useTable } from "./table-context";

type CartItem = DinerTableState["cart"][number];

/**
 * Pedido compartido de la mesa: lo que falta enviar (de todos, en vivo) y lo ya pedido, por persona.
 * No se muestran importes: el total se ve al pedir la cuenta.
 */
export function OrderSheet({ onClose }: { onClose: () => void }) {
  const t = useTable()!;
  const { info } = t;
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cart = info.state.cart;
  // Todo lo enviado, aplanado: a la mesa le importa quién pidió qué y cómo va, no en qué envío.
  const sent = info.state.orders.flatMap((o) =>
    o.items.map((i) => ({ ...i, phase: itemPhase(o.status, i.status), rejectReason: o.rejectReason })),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Agrupar lo pendiente por persona ("Vos", "Ana", "Comensal 2"…).
  const myId = info.diner?.dinerId;
  const people = groupByPerson(cart, myId);

  const send = () =>
    startSend(async () => {
      const res = await t.send();
      if (res.error) return setError(res.error);
      setError(null);
      t.toast("¡Pedido enviado! El mozo lo confirma enseguida.");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label="Pedido de la mesa">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" tabIndex={-1} />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Pedido de la mesa {info.label}</h2>
            <p className="text-xs text-muted">Todos los de la mesa ven y suman al mismo pedido, en vivo.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-full hover:bg-ink/5">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Por enviar */}
          {cart.length > 0 ? (
            <section className="space-y-4">
              <p className="text-sm font-semibold">Por enviar</p>
              {people.map((g) => (
                <div key={g.label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                  <ul className="divide-y divide-line rounded-2xl border border-line">
                    {g.items.map((i) => (
                      <CartRow key={i.id} item={i} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : (
            sent.length === 0 && (
              <div className="py-10 text-center text-sm text-muted">
                <p className="font-medium text-ink">Todavía no hay nada</p>
                <p className="mt-1">Elegí platos de la carta y tocá &ldquo;Añadir&rdquo;.</p>
              </div>
            )
          )}

          {/* Lo ya pedido: por persona, con el estado de cada plato (sin "rondas") */}
          {sent.length > 0 && (
            <section className="space-y-3">
              <p className="text-sm font-semibold">Lo pedido en la mesa</p>
              <div className="divide-y divide-line rounded-2xl border border-line">
                {groupByPerson(sent, myId).map((g) => (
                  <div key={g.label} className="p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                    <ul className="space-y-1.5 text-sm">
                      {g.items.map((i) => {
                        const ph = PHASE_LABEL[i.phase];
                        return (
                          <li key={i.id} className="flex items-start gap-2">
                            <span className="w-6 shrink-0 font-semibold tabular-nums">{i.quantity}×</span>
                            <span className={cn("min-w-0 flex-1", i.phase === "rejected" && "text-muted line-through")}>
                              {i.name}
                              {i.modifiers.length > 0 && (
                                <span className="block text-xs text-muted no-underline">{i.modifiers.map((m) => m.name).join(", ")}</span>
                              )}
                              {i.phase === "rejected" && i.rejectReason && (
                                <span className="block text-xs text-danger">{i.rejectReason}</span>
                              )}
                            </span>
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", ph.className)}>{ph.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <button
              onClick={send}
              disabled={sending || !t.canOrder}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-brand-ink disabled:opacity-50"
            >
              <Send className="size-5" aria-hidden />
              {sending ? "Enviando…" : `Enviar pedido (${cart.reduce((n, i) => n + i.quantity, 0)})`}
            </button>
            <p className="text-center text-xs text-muted">
              Se envía lo de <strong className="text-ink">{joinNames(people.map((g) => g.label))}</strong>. El mozo lo confirma y pasa a cocina.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const t = useTable()!;
  const [busy, start] = useTransition();
  const change = (q: number) => start(async () => void (await t.setQty(item.id, q)));

  return (
    <li className={cn("flex items-center gap-3 p-3", busy && "opacity-60")}>
      <Photo src={item.imageUrl} seed={item.productId} fade="right" to="surface" className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{item.name}</p>
        {item.modifiers.length > 0 && <p className="text-xs text-muted">{item.modifiers.map((m) => m.name).join(", ")}</p>}
        {item.notes && <p className="text-xs italic text-muted">“{item.notes}”</p>}
        {!item.available && <p className="text-xs font-medium text-danger">Se agotó: quitalo para enviar</p>}
      </div>
      <div className="flex shrink-0 items-center rounded-full border border-line">
        <button onClick={() => change(item.quantity - 1)} disabled={busy} className="p-2" aria-label="Uno menos">
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
        <button onClick={() => change(item.quantity + 1)} disabled={busy || item.quantity >= 20} className="p-2" aria-label="Uno más">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
