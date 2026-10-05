"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BellRing, HandPlatter, ReceiptText, X } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { useLive } from "@/lib/realtime/use-live";

type Toast = { id: number; kind: "order" | "call" | "ready"; title: string; detail: string };

/** Dos tonos cortos con Web Audio (sin archivos). Los navegadores lo permiten tras el primer toque en la página. */
function chime(kind: Toast["kind"]) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "order" ? [880, 1175] : kind === "ready" ? [1047, 1319, 1568] : [660, 660];
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
 * y muestra avisos con sonido de pedidos nuevos y llamadas al mozo.
 * Mozo: solo sus mesas y las que no tienen mozo. Caja / admin: todas.
 */
export function StaffLive({
  channel,
  membershipId,
  role,
  salaHref,
  singleScreen = false,
}: {
  /** Local con una sola pantalla de preparación: cocina y barra reciben todo. */
  singleScreen?: boolean;
  channel: string | null;
  membershipId: string;
  role: Role;
  salaHref: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    chime(t.kind);
    if (navigator.vibrate) navigator.vibrate(t.kind === "order" ? [120, 60, 120] : [250]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 10_000);
  }, []);

  const onEvent = useCallback(
    (e: Record<string, unknown>) => {
      // Cocina / bar: solo pedidos aceptados con platos de su estación.
      if (role === "COCINA" || role === "BAR") {
        const mine = singleScreen || role === "COCINA" ? "KITCHEN" : "BAR";
        if (e.type === "kitchen.new" && (e.stations as string[] | undefined)?.includes(mine)) {
          push({ kind: "order", title: `Nuevo pedido · Mesa ${e.tableLabel}`, detail: "Aparece en Nuevos" });
        }
        return;
      }
      const waiterId = (e.waiterId as string | null | undefined) ?? null;
      const relevant = role !== "MOZO" || !waiterId || waiterId === membershipId;
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
    },
    [membershipId, role, push, singleScreen],
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
          <span
            className={
              t.kind === "order"
                ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"
                : t.kind === "ready"
                  ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-ok text-white"
                  : "flex size-9 shrink-0 items-center justify-center rounded-full bg-warn text-white"
            }
          >
            {t.kind === "order" ? (
              <ReceiptText className="size-5" aria-hidden />
            ) : t.kind === "ready" ? (
              <HandPlatter className="size-5" aria-hidden />
            ) : (
              <BellRing className="size-5" aria-hidden />
            )}
          </span>
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
