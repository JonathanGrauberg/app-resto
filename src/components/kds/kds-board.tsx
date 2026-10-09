"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, BellRing, Check, ChefHat, Clock, Flame, RotateCcw, Wine } from "lucide-react";
import { cn } from "@/lib/format";
import type { KdsOrder } from "@/lib/kds";
import { callWaiterFromKitchen, cancelItems, readyItems, startItems, undoReady } from "@/app/staff/kds-actions";
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
        <div className="ml-auto">
          <CallWaiter orderId={null} from={station} label="Llamar a un mozo" />
        </div>
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
                  <Ticket key={o.id} order={o} column={col.id} now={now} station={station} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ticket({
  order: o,
  column,
  now,
  station,
}: {
  order: KdsOrder;
  column: Column;
  now: number | null;
  station: "KITCHEN" | "BAR";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null); // plato que no se puede hacer
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
            {column !== "ready" && i.status !== "READY" && (
              <button
                onClick={() => setRejecting(rejecting === i.id ? null : i.id)}
                disabled={pending}
                aria-label={`No se puede hacer ${i.name}`}
                title="No se puede hacer (falta algo)"
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border border-danger/40 text-danger hover:bg-danger-soft",
                  rejecting === i.id && "bg-danger-soft",
                )}
              >
                <Ban className="size-5" aria-hidden />
              </button>
            )}
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

      {rejecting && o.items.some((i) => i.id === rejecting) && (
        <RejectItem
          item={o.items.find((i) => i.id === rejecting)!}
          pending={pending}
          onCancel={() => setRejecting(null)}
          onConfirm={(reason, soldOut) =>
            run(async () => {
              const res = await cancelItems([rejecting], reason, soldOut);
              if (!res?.error) setRejecting(null);
              return res;
            })
          }
        />
      )}

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
      <div className="mt-2">
        <CallWaiter orderId={o.id} from={station} label={o.waiterName ? `Llamar a ${o.waiterName}` : "Llamar al mozo"} compact />
      </div>
      {error && <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </article>
  );
}

const REJECT_REASONS = ["Falta un ingrediente", "Se terminó", "No llega a tiempo"];

/** "No se puede hacer": motivo rápido y, opcional, marcar el plato agotado en la carta. */
function RejectItem({
  item,
  pending,
  onCancel,
  onConfirm,
}: {
  item: KdsOrder["items"][number];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, soldOut: boolean) => void;
}) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [soldOut, setSoldOut] = useState(true);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-danger/40 bg-danger-soft/40 p-3">
      <p className="text-sm font-semibold">
        No se puede hacer: {item.quantity}× {item.name}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {REJECT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              reason === r ? "border-danger bg-danger text-white" : "border-line bg-surface hover:bg-ink/5",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={140}
        placeholder="Motivo (lo ve el mozo y la mesa)"
        aria-label="Motivo"
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        Marcarlo agotado en la carta (nadie más lo puede pedir)
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg py-2 text-sm hover:bg-ink/5">
          Volver
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason, soldOut)}
          disabled={pending}
          className="flex-1 rounded-lg bg-danger py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          No se puede hacer
        </button>
      </div>
    </div>
  );
}

const CALL_MESSAGES = ["Pasá por la cocina", "Tengo una consulta sobre el pedido", "Hay algo para llevar"];

/** Llamar al mozo desde cocina/barra: el de la mesa (si el pedido tiene) o a todos. */
function CallWaiter({
  orderId,
  from,
  label,
  compact = false,
}: {
  orderId: string | null;
  from: "KITCHEN" | "BAR";
  label: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(CALL_MESSAGES[0]);
  const [feedback, setFeedback] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await callWaiterFromKitchen(orderId, message, from);
      setFeedback(res ?? null);
      if (!res?.error) {
        setOpen(false);
        setTimeout(() => setFeedback(null), 4000);
      }
    });

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setOpen(true);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl text-sm font-medium",
            compact ? "px-2 py-1.5 text-muted hover:bg-ink/5 hover:text-ink" : "h-11 border border-line bg-surface px-4 hover:bg-ink/5",
          )}
        >
          <BellRing className="size-4" aria-hidden /> {label}
        </button>
        {feedback?.ok && <span className="text-xs font-medium text-ok">{feedback.ok}</span>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 rounded-xl border border-line bg-surface p-3", !compact && "w-80 max-w-full shadow-lg")}>
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {CALL_MESSAGES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMessage(m)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              message === m ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-ink/5",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={140}
        aria-label="Mensaje para el mozo"
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
      />
      {feedback?.error && <p className="text-xs text-danger">{feedback.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg py-2 text-sm hover:bg-ink/5">
          Cancelar
        </button>
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {pending ? "Avisando…" : "Avisar"}
        </button>
      </div>
    </div>
  );
}
