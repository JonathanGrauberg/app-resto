"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useTable } from "@/components/table/table-context";
import { joinNames } from "@/lib/people";
import { Minus, Plus } from "lucide-react";
import { Photo } from "@/components/mock-image";
import { ALLERGENS } from "@/lib/allergens";
import { cn, formatPrice } from "@/lib/format";
import type { PublicProduct } from "@/lib/public-menu";
import { CloseButton } from "./menu-browser";

/**
 * Ficha de producto. En celular es una hoja inferior; en pantallas grandes, un diálogo centrado.
 * Dentro de una mesa (QR), "Añadir" suma al carrito compartido de la mesa.
 */
export function ProductSheet({ product: p, onClose }: { product: PublicProduct; onClose: () => void }) {
  const table = useTable();
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que ya hay de este plato en la mesa (pedido o en el carrito de otro), para no repetir sin querer.
  const myId = table?.info.diner?.dinerId;
  const who = (addedById: string | null, addedBy: string | null) => (myId && addedById === myId ? "vos" : (addedBy ?? "el mozo"));
  const alreadyOrdered = table
    ? table.info.state.orders
        .filter((o) => o.status !== "REJECTED")
        .flatMap((o) => o.items.filter((i) => i.productId === p.id).map((i) => `${who(i.addedById, i.addedBy)} (${i.quantity}×)`))
    : [];
  const inCart = table
    ? table.info.state.cart.filter((c) => c.productId === p.id).map((c) => `${who(c.addedById, c.addedBy)} (${c.quantity}×)`)
    : [];

  const add = async () => {
    if (!table) return;
    setAdding(true);
    setError(null);
    const res = await table.add({ productId: p.id, quantity: qty, optionIds: Object.values(selected).flat(), notes });
    setAdding(false);
    if (res.ok) {
      table.toast(qty > 1 ? `${qty}× ${p.name} al pedido` : `${p.name} al pedido`);
      onClose();
    } else if (res.error && res.error !== "cancelado") {
      setError(res.error);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const toggle = (groupId: string, optionId: string, max: number) =>
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter((o) => o !== optionId) };
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });

  const extras = p.modifierGroups.flatMap((g) =>
    g.options.filter((o) => selected[g.id]?.includes(o.id)).map((o) => o.extraPriceCents),
  );
  const unit = p.priceCents + extras.reduce((a, b) => a + b, 0);
  const missingRequired = p.modifierGroups.some((g) => (selected[g.id]?.length ?? 0) < g.minSelect);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"  role="dialog" aria-modal aria-label={p.name}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" tabIndex={-1} />

      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface sm:max-w-lg sm:rounded-3xl lg:h-[min(640px,88dvh)] lg:max-w-4xl lg:flex-row">
        <CloseButton onClick={onClose} className="absolute right-3 top-3 z-10" />

        {/* En PC la foto ocupa la columna izquierda y funde hacia el panel */}
        <Photo
          src={p.imageUrl}
          seed={p.id}
          kind={p.station === "BAR" ? "bar" : "kitchen"}
          label={p.name}
          fade="right"
          to="surface"
          className="hidden lg:block lg:w-1/2 lg:shrink-0"
        />

        <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <Photo
            src={p.imageUrl}
            seed={p.id}
            kind={p.station === "BAR" ? "bar" : "kitchen"}
            label={p.name}
            fade="bottom"
            to="surface"
            className="aspect-[16/10] w-full lg:hidden"
          />

          <div className="relative -mt-10 space-y-5 p-5 lg:mt-0 lg:pt-14">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{p.name}</h2>
              {p.description && <p className="mt-1 text-muted">{p.description}</p>}
              <p className="mt-2 text-lg font-semibold tabular-nums">{formatPrice(p.priceCents)}</p>
            </div>

            {p.allergens.length > 0 ? (
              <div>
                <p className="mb-1.5 text-sm font-medium">Alérgenos</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.allergens.map((a) => (
                    <span key={a} className="rounded-full bg-warn-soft px-2.5 py-1 text-sm text-warn">
                      {ALLERGENS[a].label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Sin alérgenos declarados.</p>
            )}

            {p.modifierGroups.map((g) => (
              <fieldset key={g.id}>
                <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium">
                  {g.name}
                  <span className="text-xs font-normal text-muted">
                    {g.minSelect > 0 ? "Obligatorio" : "Opcional"}
                    {g.maxSelect > 1 ? ` · hasta ${g.maxSelect}` : ""}
                  </span>
                </legend>
                <div className="divide-y divide-line rounded-xl border border-line">
                  {g.options.map((o) => {
                    const checked = selected[g.id]?.includes(o.id) ?? false;
                    return (
                      <label key={o.id} className="flex cursor-pointer items-center gap-3 px-3 py-3">
                        <input
                          type={g.maxSelect === 1 ? "radio" : "checkbox"}
                          name={g.id}
                          checked={checked}
                          onChange={() => toggle(g.id, o.id, g.maxSelect)}
                          className="size-5 accent-[var(--color-brand)]"
                        />
                        <span className="flex-1">{o.name}</span>
                        {o.extraPriceCents > 0 && (
                          <span className="text-sm text-muted">+{formatPrice(o.extraPriceCents)}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {(alreadyOrdered.length > 0 || inCart.length > 0) && (
              <div className="flex gap-2.5 rounded-xl border border-brand/40 bg-brand-soft p-3 text-sm">
                <Users className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <div className="space-y-0.5">
                  {alreadyOrdered.length > 0 && (
                    <p>
                      <span className="font-semibold">Ya lo pidieron en esta mesa:</span> {joinNames(alreadyOrdered)}.
                    </p>
                  )}
                  {inCart.length > 0 && (
                    <p>
                      <span className="font-semibold">Está en el pedido sin enviar:</span> {joinNames(inCart)}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {table && (
              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">
                  Notas para cocina
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  maxLength={140}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej.: sin sal, bien caliente…"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base focus:border-brand focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {!p.available ? (
            <p className="text-center font-medium text-danger">Agotado por hoy</p>
          ) : table && !table.canOrder ? (
            <p className="text-center text-sm text-muted">La mesa está cerrando la cuenta: ya no se pueden sumar pedidos.</p>
          ) : table ? (
            <div className="flex gap-3">
              <div className="flex items-center rounded-xl border border-line">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3" aria-label="Menos">
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="w-6 text-center font-medium tabular-nums">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(20, q + 1))} className="p-3" aria-label="Más">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              <button
                onClick={add}
                disabled={missingRequired || adding}
                className={cn(
                  "flex h-12 flex-1 items-center justify-between rounded-xl bg-brand px-4 font-medium text-brand-ink",
                  "disabled:opacity-50",
                )}
              >
                <span>{missingRequired ? "Elegí las opciones" : adding ? "Agregando…" : "Añadir al pedido"}</span>
                <span className="tabular-nums">{formatPrice(unit * qty)}</span>
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted">Escaneá el QR de tu mesa para hacer tu pedido.</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
