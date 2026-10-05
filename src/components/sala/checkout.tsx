"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Banknote, CheckCircle2, CreditCard, Gift, Minus, Plus, Printer, Smartphone, Trash2, Wallet, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import type { Bill } from "@/lib/billing";
import { checkout, compItem, confirmPayment, getBill, setDiscount } from "@/app/staff/sala-actions";

type Method = "CASH" | "CARD" | "BIZUM" | "OTHER";
const METHODS: { id: Method; label: string; icon: typeof Banknote }[] = [
  { id: "CASH", label: "Efectivo", icon: Banknote },
  { id: "CARD", label: "Tarjeta", icon: CreditCard },
  { id: "BIZUM", label: "Bizum", icon: Smartphone },
  { id: "OTHER", label: "Otro", icon: Wallet },
];

type Draft = { key: number; method: Method; amount: string; tip: string; received: string };

/** "12,50" → 1250 céntimos (null si no es un importe válido). Vacío = 0. */
function toCents(v: string) {
  const s = v.replace(/\s|€/g, "").replace(",", ".");
  if (s === "") return 0;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
const toInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

let seq = 0;

/**
 * Cobrar una mesa: invitaciones por plato, descuento, uno o varios pagos (dividir / mixto),
 * propina y cambio en efectivo. El servidor recalcula y valida todo antes de cerrar.
 */
export function CheckoutDialog({
  sessionId,
  title,
  onClose,
  onDone,
}: {
  sessionId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [discKind, setDiscKind] = useState<"percent" | "amount">("percent");
  const [discValue, setDiscValue] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [splitN, setSplitN] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const b = await getBill(sessionId);
    setBill(b);
    return b;
  }, [sessionId]);

  // `onClose` cambia en cada render del panel (que se refresca en vivo): se guarda en un ref para que
  // la carga inicial corra UNA sola vez y nunca pise los pagos que el cajero ya cargó.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    getBill(sessionId).then((b) => {
      if (!alive || !b) return;
      setBill(b);
      // Arranca con un pago con tarjeta por el total (lo más común); se cambia con un toque.
      setDrafts([{ key: ++seq, method: "CARD", amount: toInput(b.remainingCents), tip: "", received: "" }]);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sessionId]);

  const remaining = bill?.remainingCents ?? 0;
  const assigned = drafts.reduce((n, d) => n + (toCents(d.amount) ?? 0), 0);
  const diff = assigned - remaining;
  const invalid = drafts.some((d) => toCents(d.amount) === null || toCents(d.tip) === null || toCents(d.received) === null);
  const tips = drafts.reduce((n, d) => n + (toCents(d.tip) ?? 0), 0);

  /** Reparte lo que falta en N pagos iguales (los céntimos sobrantes, de a uno). */
  const split = (n: number, method: Method) => {
    const base = Math.floor(remaining / n);
    const extra = remaining - base * n;
    setDrafts(
      Array.from({ length: n }, (_, i) => ({
        key: ++seq,
        method,
        amount: toInput(base + (i < extra ? 1 : 0)),
        tip: "",
        received: "",
      })),
    );
  };

  const addPayment = (method: Method) => {
    const left = Math.max(0, remaining - assigned);
    setDrafts((prev) => [...prev, { key: ++seq, method, amount: toInput(left), tip: "", received: "" }]);
  };

  const update = (key: number, patch: Partial<Draft>) => setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const afterChange = async () => {
    const b = await load();
    // Si cambió el total (invitación/descuento) y había un solo pago, se ajusta solo.
    if (b) setDrafts((prev) => (prev.length === 1 ? [{ ...prev[0], amount: toInput(b.remainingCents) }] : prev));
  };

  const toggleComp = (itemId: string, comped: boolean) =>
    start(async () => {
      const res = await compItem(itemId, comped);
      if (res?.error) return setError(res.error);
      setError(null);
      await afterChange();
    });

  const applyDiscount = (clear = false) =>
    start(async () => {
      const value = clear ? 0 : Number(discValue.replace(",", "."));
      const res = await setDiscount(sessionId, { kind: discKind, value, reason: discReason });
      if (res?.error) return setError(res.error);
      setError(null);
      if (clear) {
        setDiscValue("");
        setDiscReason("");
      }
      await afterChange();
    });

  const pay = () =>
    start(async () => {
      const res =
        remaining === 0
          ? await confirmPayment(sessionId)
          : await checkout(
              sessionId,
              drafts.map((d) => ({
                method: d.method,
                amountCents: toCents(d.amount) ?? 0,
                tipCents: toCents(d.tip) ?? 0,
                receivedCents: d.method === "CASH" && d.received ? toCents(d.received) : null,
              })),
            );
      if (res?.error) return setError(res.error);
      setError(null);
      setDone(true);
      onDone();
    });

  const body = !bill ? (
    <p className="p-10 text-center text-muted">Cargando la cuenta…</p>
  ) : done ? (
    <div className="flex flex-col items-center gap-4 p-10 text-center">
      <CheckCircle2 className="size-14 text-ok" aria-hidden />
      <div>
        <p className="text-2xl font-bold">¡Cobrado!</p>
        <p className="text-muted">
          {title} quedó libre{tips > 0 ? ` · Propina: ${formatPrice(tips)}` : ""}.
        </p>
      </div>
      <div className="flex w-full max-w-sm gap-2">
        <a
          href={`/staff/cuenta/${sessionId}?auto=1`}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line font-medium hover:bg-ink/5"
        >
          <Printer className="size-4" aria-hidden /> Imprimir ticket
        </a>
        <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-ink font-semibold text-bg">
          Listo
        </button>
      </div>
    </div>
  ) : (
    <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_400px]">
      {/* Consumo + invitaciones */}
      <div className="min-h-0 overflow-y-auto p-4">
        <p className="mb-2 text-sm font-semibold">Consumo</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {bill.items.map((i) => (
            <li key={i.id} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", i.comped && "bg-ok-soft/40")}>
              <span className="w-7 shrink-0 font-semibold tabular-nums">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className={cn(i.comped && "line-through opacity-60")}>{i.name}</span>
                <span className="block text-xs text-muted">
                  {[i.addedBy, ...i.modifiers].filter(Boolean).join(" · ")}
                  {i.comped && <span className="font-medium text-ok"> · Invita la casa</span>}
                </span>
              </span>
              <span className={cn("shrink-0 tabular-nums", i.comped && "text-muted line-through")}>{formatPrice(i.lineCents)}</span>
              <button
                onClick={() => toggleComp(i.id, !i.comped)}
                disabled={pending || bill.paidCents > 0}
                title={i.comped ? "Quitar invitación" : "Invita la casa"}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs",
                  i.comped ? "bg-ok text-white" : "border border-line hover:bg-ink/5",
                )}
              >
                <Gift className="size-3.5" aria-hidden /> {i.comped ? "Invitado" : "Invitar"}
              </button>
            </li>
          ))}
        </ul>

        <p className="mb-2 mt-5 text-sm font-semibold">Descuento</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-ink/5 p-0.5 text-sm">
            {(["percent", "amount"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setDiscKind(k)}
                className={cn("rounded-md px-3 py-1.5", discKind === k ? "bg-surface shadow-sm" : "text-muted")}
              >
                {k === "percent" ? "%" : "€"}
              </button>
            ))}
          </div>
          <input
            value={discValue}
            onChange={(e) => setDiscValue(e.target.value)}
            inputMode="decimal"
            placeholder={discKind === "percent" ? "10" : "5,00"}
            aria-label="Valor del descuento"
            className="h-10 w-24 rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
          />
          <input
            value={discReason}
            onChange={(e) => setDiscReason(e.target.value)}
            placeholder="Motivo (opcional)"
            aria-label="Motivo del descuento"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
          />
          <button
            onClick={() => applyDiscount()}
            disabled={pending || !discValue || bill.paidCents > 0}
            className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-bg disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
        {bill.discountCents > 0 && (
          <p className="mt-2 flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2 text-sm">
            <span>
              Descuento {bill.discountReason ? `· ${bill.discountReason}` : ""}: <strong>−{formatPrice(bill.discountCents)}</strong>
            </span>
            <button onClick={() => applyDiscount(true)} className="text-xs text-muted underline-offset-2 hover:underline">
              Quitar
            </button>
          </p>
        )}
      </div>

      {/* Totales + pagos */}
      <div className="flex min-h-0 flex-col border-t border-line md:border-l md:border-t-0">
        <div className="space-y-1 border-b border-line p-4 text-sm">
          <Row label="Consumo" value={formatPrice(bill.consumedCents)} />
          {bill.compsCents > 0 && <Row label="Invitaciones" value={`−${formatPrice(bill.compsCents)}`} />}
          {bill.discountCents > 0 && <Row label="Descuento" value={`−${formatPrice(bill.discountCents)}`} />}
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-semibold">Total a cobrar</span>
            <span className="text-3xl font-bold tabular-nums">{formatPrice(bill.totalCents)}</span>
          </div>
          <p className="text-right text-xs text-muted">IVA incluido</p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {remaining > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Pagos</p>
                <div className="flex items-center gap-1 text-xs">
                  Dividir en
                  <div className="flex items-center rounded-lg border border-line">
                    <button onClick={() => setSplitN((n) => Math.max(2, n - 1))} className="p-1.5" aria-label="Menos partes">
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span className="w-5 text-center font-semibold tabular-nums">{splitN}</span>
                    <button onClick={() => setSplitN((n) => Math.min(20, n + 1))} className="p-1.5" aria-label="Más partes">
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <button
                    onClick={() => split(splitN, drafts[0]?.method ?? "CARD")}
                    className="rounded-lg bg-ink/5 px-2 py-1.5 font-medium hover:bg-ink/10"
                  >
                    partes iguales
                  </button>
                </div>
              </div>

              {drafts.map((d) => {
                const amount = toCents(d.amount) ?? 0;
                const tip = toCents(d.tip) ?? 0;
                const received = toCents(d.received) ?? 0;
                const change = d.method === "CASH" && received > 0 ? received - amount - tip : null;
                return (
                  <div key={d.key} className="space-y-2 rounded-xl border border-line p-3">
                    <div className="flex items-center gap-1">
                      {METHODS.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => update(d.key, { method: id })}
                          aria-pressed={d.method === id}
                          title={label}
                          className={cn(
                            "inline-flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs",
                            d.method === id ? "bg-ink text-bg" : "bg-ink/5 hover:bg-ink/10",
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden /> <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                      {drafts.length > 1 && (
                        <button
                          onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                          aria-label="Quitar pago"
                          className="ml-1 rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MoneyInput label="Importe" value={d.amount} onChange={(v) => update(d.key, { amount: v })} />
                      <MoneyInput label="Propina" value={d.tip} onChange={(v) => update(d.key, { tip: v })} placeholder="0,00" />
                    </div>
                    {d.method === "CASH" && (
                      <div className="grid grid-cols-2 items-end gap-2">
                        <MoneyInput label="Entrega" value={d.received} onChange={(v) => update(d.key, { received: v })} placeholder="ej. 50" />
                        <p
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            change === null ? "text-muted" : change < 0 ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
                          )}
                        >
                          {change === null ? "Cambio: —" : change < 0 ? `Faltan ${formatPrice(-change)}` : `Cambio: ${formatPrice(change)}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-1.5">
                {METHODS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => addPayment(id)}
                    className="rounded-full px-3 py-1.5 text-xs ring-1 ring-line hover:ring-ink/30"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {remaining === 0 && (
            <p className="rounded-xl bg-ok-soft p-3 text-sm text-ok">No queda nada por cobrar (todo invitado o con descuento).</p>
          )}
        </div>

        <div className="space-y-2 border-t border-line p-4">
          {remaining > 0 && diff !== 0 && !invalid && (
            <p className={cn("text-center text-sm font-medium", diff < 0 ? "text-warn" : "text-danger")}>
              {diff < 0 ? `Falta asignar ${formatPrice(-diff)}` : `Sobra ${formatPrice(diff)}: revisá los importes`}
            </p>
          )}
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <button
            onClick={pay}
            disabled={pending || (remaining > 0 && (diff !== 0 || invalid))}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-ok text-base font-semibold text-white disabled:opacity-40"
          >
            {pending
              ? "Procesando…"
              : remaining === 0
                ? "Cerrar mesa sin cobro"
                : `Cobrar ${formatPrice(remaining)}${tips > 0 ? ` + ${formatPrice(tips)} propina` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:p-4" role="dialog" aria-modal aria-label={`Cobrar ${title}`}>
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden bg-surface sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button onClick={onClose} aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-full hover:bg-ink/5">
            <X className="size-5" aria-hidden />
          </button>
          <p className="flex-1 text-lg font-bold">Cobrar · {title}</p>
          {bill && !done && (
            <a href={`/staff/cuenta/${sessionId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
              <Printer className="size-4" aria-hidden /> Pre-cuenta
            </a>
          )}
        </header>
        {body}
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const bad = toCents(value) === null;
  return (
    <label className="block text-xs text-muted">
      {label}
      <span className="relative mt-1 block">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder={placeholder}
          className={cn(
            "h-10 w-full rounded-lg border bg-surface pl-3 pr-7 text-base text-ink tabular-nums sm:text-sm",
            bad ? "border-danger" : "border-line",
          )}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">€</span>
      </span>
    </label>
  );
}
