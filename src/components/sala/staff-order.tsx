"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Minus, Plus, Search, Send, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import type { PublicMenu, PublicProduct } from "@/lib/public-menu";
import { matchesQuery } from "@/lib/search";
import { createStaffOrder } from "@/app/staff/sala-actions";

type Line = {
  key: string;
  product: PublicProduct;
  quantity: number;
  optionIds: string[];
  notes: string;
  who: string;
};

let seq = 0;

/**
 * El mozo toma el pedido en la mesa (sin celular de los comensales).
 * Tocar un plato lo suma; si tiene opciones obligatorias o extras, se eligen antes.
 * "¿Para quién?" es opcional: sirve para el consumo por persona y para dividir la cuenta.
 * El pedido entra ya aceptado y va directo a cocina/bar.
 */
export function StaffOrderComposer({
  sessionId,
  tableTitle,
  menu,
  knownNames,
  onClose,
  onDone,
}: {
  sessionId: string;
  tableTitle: string;
  menu: PublicMenu;
  knownNames: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [who, setWho] = useState("");
  const [names, setNames] = useState<string[]>(knownNames);
  const [newName, setNewName] = useState("");
  const [picking, setPicking] = useState<PublicProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const [showTicket, setShowTicket] = useState(false); // celular: alterna carta / pedido

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !picking && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, picking]);

  const products = useMemo(
    () =>
      menu
        .filter((c) => !cat || c.id === cat)
        .flatMap((c) => c.products.filter((p) => matchesQuery(query, [p.name, p.description, c.name, ...p.tags])).map((p) => ({ ...p, category: c.name }))),
    [menu, cat, query],
  );

  const unitOf = (l: Line) =>
    l.product.priceCents +
    l.product.modifierGroups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id)).reduce((n, o) => n + o.extraPriceCents, 0);
  const total = lines.reduce((n, l) => n + unitOf(l) * l.quantity, 0);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  const add = (product: PublicProduct, optionIds: string[] = [], notes = "") => {
    setLines((prev) => {
      // Mismo plato, mismas opciones, misma persona y sin nota → suma cantidad.
      const same = prev.find(
        (l) => l.product.id === product.id && l.who === who && !l.notes && !notes && l.optionIds.join() === [...optionIds].sort().join(),
      );
      if (same) return prev.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: `l${++seq}`, product, quantity: 1, optionIds: [...optionIds].sort(), notes, who }];
    });
  };

  const tap = (p: PublicProduct) => {
    if (!p.available) return;
    if (p.modifierGroups.length) setPicking(p);
    else add(p);
  };

  const send = () =>
    start(async () => {
      const res = await createStaffOrder(
        sessionId,
        lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, optionIds: l.optionIds, notes: l.notes, who: l.who })),
      );
      if (res?.error) return setError(res.error);
      onDone();
      onClose();
    });

  const ticket = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-4">
        <p className="mb-2 text-sm font-medium">¿Para quién? <span className="font-normal text-muted">(opcional)</span></p>
        <div className="flex flex-wrap gap-1.5">
          {["", ...names].map((n) => (
            <button
              key={n || "_mesa"}
              onClick={() => setWho(n)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                who === n ? "bg-ink text-bg" : "ring-1 ring-line hover:ring-ink/30",
              )}
            >
              {n || "Mesa"}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim().slice(0, 20);
              if (!n) return;
              if (!names.includes(n)) setNames((prev) => [...prev, n]);
              setWho(n);
              setNewName("");
            }}
            className="flex"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="+ nombre"
              aria-label="Agregar nombre de comensal"
              className="h-8 w-24 rounded-full bg-transparent px-3 text-sm ring-1 ring-line focus:outline-none focus:ring-brand"
            />
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Tocá los platos de la carta para sumarlos.</p>
        ) : (
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.key} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{l.product.name}</p>
                    {l.optionIds.length > 0 && (
                      <p className="text-xs text-muted">
                        {l.product.modifierGroups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id)).map((o) => o.name).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-muted">{l.who || "Mesa"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(unitOf(l) * l.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-line">
                    <button
                      onClick={() => setLines((prev) => prev.flatMap((x) => (x === l ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))}
                      className="p-2"
                      aria-label="Uno menos"
                    >
                      <Minus className="size-4" aria-hidden />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                    <button
                      onClick={() => setLines((prev) => prev.map((x) => (x === l ? { ...x, quantity: Math.min(50, x.quantity + 1) } : x)))}
                      className="p-2"
                      aria-label="Uno más"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  </div>
                  <input
                    value={l.notes}
                    onChange={(e) => setLines((prev) => prev.map((x) => (x === l ? { ...x, notes: e.target.value.slice(0, 140) } : x)))}
                    placeholder="Nota para cocina"
                    aria-label={`Nota para ${l.product.name}`}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-base sm:text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-line p-4">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Total de este pedido</span>
          <span className="text-lg font-bold tabular-nums">{formatPrice(total)}</span>
        </div>
        <button
          onClick={send}
          disabled={sending || lines.length === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden /> {sending ? "Enviando…" : `Enviar a cocina (${count})`}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:p-4" role="dialog" aria-modal aria-label={`Tomar pedido · ${tableTitle}`}>
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden bg-surface sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button onClick={onClose} aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-full hover:bg-ink/5">
            <X className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">Tomar pedido · {tableTitle}</p>
            <p className="text-xs text-muted">Entra aceptado y va directo a cocina y barra</p>
          </div>
          {/* Celular: ver el pedido armado */}
          <button
            onClick={() => setShowTicket((v) => !v)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg md:hidden"
          >
            {showTicket ? "Ver carta" : `Pedido (${count})`}
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_360px]">
          {/* Carta */}
          <div className={cn("flex min-h-0 flex-col", showTicket && "hidden md:flex")}>
            <div className="space-y-2 border-b border-line p-3">
              <label className="relative block">
                <span className="sr-only">Buscar plato</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar plato…"
                  className="h-11 w-full rounded-xl border border-line bg-bg pl-9 pr-3 text-base focus:border-brand focus:outline-none sm:text-sm"
                />
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {[{ id: null as string | null, name: "Todo" }, ...menu.map((c) => ({ id: c.id as string | null, name: c.name }))].map((c) => (
                  <button
                    key={c.id ?? "_all"}
                    onClick={() => setCat(c.id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-sm",
                      cat === c.id ? "bg-ink text-bg" : "ring-1 ring-line hover:ring-ink/30",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <ul className="grid flex-1 auto-rows-min gap-2 overflow-y-auto p-3 sm:grid-cols-2">
              {products.map((p) => {
                const inTicket = lines.filter((l) => l.product.id === p.id).reduce((n, l) => n + l.quantity, 0);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => tap(p)}
                      disabled={!p.available}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                        inTicket ? "border-brand bg-brand-soft" : "border-line hover:border-ink/30",
                        !p.available && "opacity-40",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-tight">{p.name}</span>
                        <span className="text-xs text-muted">
                          {p.available ? p.category : "Agotado"}
                          {p.modifierGroups.length > 0 && " · con opciones"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(p.priceCents)}</span>
                      {inTicket > 0 && (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">
                          {inTicket}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {products.length === 0 && <li className="py-10 text-center text-sm text-muted sm:col-span-2">Sin resultados</li>}
            </ul>
          </div>

          {/* Pedido */}
          <aside className={cn("min-h-0 border-l border-line", !showTicket && "hidden md:block")}>{ticket}</aside>
        </div>

        {picking && (
          <OptionsPicker
            product={picking}
            onCancel={() => setPicking(null)}
            onAdd={(optionIds, notes) => {
              add(picking, optionIds, notes);
              setPicking(null);
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Opciones/extras de un plato antes de sumarlo. */
function OptionsPicker({
  product: p,
  onCancel,
  onAdd,
}: {
  product: PublicProduct;
  onCancel: () => void;
  onAdd: (optionIds: string[], notes: string) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const missing = p.modifierGroups.some((g) => (selected[g.id]?.length ?? 0) < g.minSelect);

  const toggle = (groupId: string, optionId: string, max: number) =>
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter((o) => o !== optionId) };
      if (max === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-surface">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={onCancel} aria-label="Volver" className="flex size-9 items-center justify-center rounded-full hover:bg-ink/5">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <p className="flex-1 text-lg font-bold">{p.name}</p>
        <p className="font-semibold tabular-nums">{formatPrice(p.priceCents)}</p>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {p.modifierGroups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2 flex w-full justify-between text-sm font-medium">
              {g.name}
              <span className="text-xs font-normal text-muted">
                {g.minSelect > 0 ? "Obligatorio" : "Opcional"}
                {g.maxSelect > 1 ? ` · hasta ${g.maxSelect}` : ""}
              </span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.options.map((o) => {
                const on = selected[g.id]?.includes(o.id) ?? false;
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g.id, o.id, g.maxSelect)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-3 text-left",
                      on ? "border-brand bg-brand-soft" : "border-line",
                    )}
                  >
                    <span>{o.name}</span>
                    {o.extraPriceCents > 0 && <span className="text-sm text-muted">+{formatPrice(o.extraPriceCents)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={140}
          placeholder="Nota para cocina (opcional)"
          aria-label="Nota para cocina"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base sm:text-sm"
        />
      </div>
      <div className="border-t border-line p-4">
        <button
          onClick={() => onAdd(Object.values(selected).flat(), notes.trim())}
          disabled={missing}
          className="h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50"
        >
          {missing ? "Elegí las opciones obligatorias" : "Sumar al pedido"}
        </button>
      </div>
    </div>
  );
}
