"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Ban, BellRing, CalendarDays, ChefHat, HandPlatter, ReceiptText, Wallet, X } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { useLive } from "@/lib/realtime/use-live";

type Kind = "order" | "call" | "ready" | "pay" | "kitchen" | "cancel" | "booking";
type Toast = { id: number; kind: Kind; title: string; detail: string };

const KIND_STYLE: Record<Kind, { icon: typeof BellRing; className: string }> = {
  order: { icon: ReceiptText, className: "bg-brand text-brand-ink" },
  ready: { icon: HandPlatter, className: "bg-ok text-white" },
  call: { icon: BellRing, className: "bg-warn text-white" },
  pay: { icon: Wallet, className: "bg-warn text-white" },
  kitchen: { icon: ChefHat, className: "bg-brand text-brand-ink" },
  cancel: { icon: Ban, className: "bg-danger text-white" },
  booking: { icon: CalendarDays, className: "bg-brand text-brand-ink" },
};

const NOTES: Record<Kind, number[]> = {
  order: [880, 1175],
  ready: [1047, 1319, 1568],
  call: [660, 660],
  pay: [784, 988, 784, 988],
  kitchen: [523, 784, 523],
  cancel: [440, 330],
  booking: [659, 880],
};

/** Dos tonos cortos con Web Audio (sin archivos). Los navegadores lo permiten tras el primer toque en la página. */
function chime(kind: Kind) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = NOTES[kind];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

/**
 * Conexión en vivo del personal (una por pantalla): refresca los datos ante cualquier cambio
 * y muestra avisos con sonido de pedidos nuevos, llamadas al mozo, mesas para cobrar y avisos de cocina.
 * Mozo: solo sus mesas y las que no tienen mozo. Caja / admin: todas.
 * Con varios roles (ej. Caja + Mozo), recibe los avisos de cada uno.
 */
export function StaffLive({
  channel,
  membershipId,
  roles,
  salaHref,
  singleScreen = false,
}: {
  /** Local con una sola pantalla de preparación: cocina y barra reciben todo. */
  singleScreen?: boolean;
  channel: string | null;
  membershipId: string;
  roles: Role[];
  salaHref: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    chime(t.kind);
    if (navigator.vibrate) navigator.vibrate(t.kind === "order" ? [120, 60, 120] : [250]);
    // Lo que pide acción (cobrar, un plato que no sale, cocina que llama) queda más tiempo en pantalla.
    const ms = t.kind === "pay" || t.kind === "cancel" || t.kind === "kitchen" ? 25_000 : 10_000;
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ms);
  }, []);

  const onEvent = useCallback(
    (e: Record<string, unknown>) => {
      const has = (...r: Role[]) => roles.some((x) => r.includes(x));
      // Cocina / bar: solo pedidos aceptados con platos de su estación.
      if (has("COCINA", "BAR") && e.type === "kitchen.new") {
        const mine = [
          ...(has("COCINA") || singleScreen ? ["KITCHEN"] : []),
          ...(has("BAR") ? ["BAR"] : []),
        ];
        if ((e.stations as string[] | undefined)?.some((s) => mine.includes(s))) {
          push({ kind: "order", title: `Nuevo pedido · Mesa ${e.tableLabel}`, detail: "Aparece en Nuevos" });
        }
      }
      if (!has("OWNER", "ADMIN", "CAJA", "MOZO")) return;

      // Reservas online: a caja / admin.
      if (e.type === "booking.new" || e.type === "booking.cancelled") {
        if (has("OWNER", "ADMIN", "CAJA")) {
          const when = new Date(String(e.startsAt)).toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          push(
            e.type === "booking.new"
              ? { kind: "booking", title: `Nueva reserva · ${e.name} (${e.party})`, detail: `${when} · Mesa ${e.tables}` }
              : { kind: "booking", title: `Reserva cancelada · ${e.name}`, detail: when },
          );
        }
        return;
      }

      // Caja: una mesa pasó a "pendiente de cobro".
      if (e.type === "table.pending") {
        // Quien la envió (si es caja) no necesita el aviso.
        if (has("OWNER", "ADMIN", "CAJA") && e.byId !== membershipId) {
          push({ kind: "pay", title: `Mesa ${e.tableLabel} para cobrar`, detail: e.waiterName ? `La envió ${e.waiterName}` : "Pasó a pendiente de cobro" });
        }
        return;
      }

      const waiterId = (e.waiterId as string | null | undefined) ?? null;
      const onlyWaiter = !has("OWNER", "ADMIN", "CAJA");
      const relevant = !onlyWaiter || !waiterId || waiterId === membershipId;
      if (!relevant) return;
      if (e.type === "order.created") {
        push({
          kind: "order",
          title: `Pedido nuevo · Mesa ${e.tableLabel}`,
          detail: e.noWaiter ? "Mesa sin mozo: ¿quién la toma?" : "Revisalo y aceptalo para que pase a cocina",
        });
      }
      if (e.type === "item.ready") {
        push({ kind: "ready", title: `¡Listo para llevar! · Mesa ${e.tableLabel}`, detail: String(e.summary ?? "") });
      }
      if (e.type === "waiter.called") {
        push({ kind: "call", title: `Mesa ${e.tableLabel} llama al mozo`, detail: waiterId ? "" : "La mesa no tiene mozo asignado" });
      }
      if (e.type === "kitchen.call") {
        push({
          kind: "kitchen",
          title: `${e.from === "BAR" ? "Barra" : "Cocina"} te llama${e.tableLabel ? ` · Mesa ${e.tableLabel}` : ""}`,
          detail: String(e.message ?? "Pasá por la cocina"),
        });
      }
      if (e.type === "item.cancelled") {
        push({
          kind: "cancel",
          title: `No sale: ${e.summary} · Mesa ${e.tableLabel}`,
          detail: e.reason ? `Motivo: ${e.reason}. Avisale a la mesa.` : "Avisale a la mesa.",
        });
      }
    },
    [membershipId, roles, push, singleScreen],
  );

  useLive({ scope: "staff", channel, onEvent });

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex print:hidden flex-col items-center gap-2 px-3 sm:items-end sm:pr-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-line bg-surface p-3 shadow-2xl"
        >
          <ToastIcon kind={t.kind} />
          <Link href={salaHref} className="min-w-0 flex-1" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
            <p className="font-semibold leading-tight">{t.title}</p>
            {t.detail && <p className="mt-0.5 text-sm text-muted">{t.detail}</p>}
          </Link>
          <button
            onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
            aria-label="Cerrar aviso"
            className="rounded-full p-1 text-muted hover:bg-ink/5"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ kind }: { kind: Kind }) {
  const { icon: Icon, className } = KIND_STYLE[kind];
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
