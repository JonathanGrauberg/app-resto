"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Link2,
  Minus,
  NotebookPen,
  Plus,
  Printer,
  QrCode,
  SquarePlus,
  Trash2,
  Unlink,
  Wallet,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { QrDialog } from "@/components/qr-dialog";
import { OrdersSection } from "./orders-section";
import { CheckoutDialog } from "./checkout";
import { StaffOrderComposer } from "./staff-order";
import type { PublicMenu } from "@/lib/public-menu";
import { STATUS_STYLE } from "@/components/table-map";
import { cn } from "@/lib/format";
import type { SalaSession, SalaTable } from "@/lib/sala";
import {
  addExtraTable,
  assignWaiter,
  dismissCall,
  openTable,
  releaseTable,
  removeExtraTable,
  reopenTable,
  requestClose,
  separateTables,
  setGuests,
} from "@/app/staff/sala-actions";
import { elapsed, groupLabel, type Me } from "./sala-utils";

const CASHIER = ["OWNER", "ADMIN", "CAJA"];

export function TablePanel({
  table,
  members,
  session,
  areaName,
  areaId,
  menu,
  waiters,
  me,
  now,
  slug,
  venue,
  onJoin,
  onDone,
}: {
  table: SalaTable;
  members: SalaTable[];
  session: SalaSession | null;
  areaName: string;
  areaId: string;
  menu: PublicMenu;
  waiters: { id: string; name: string }[];
  me: Me;
  now: number | null;
  slug: string;
  venue: string;
  onJoin: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [extraSeats, setExtraSeats] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [paying, setPaying] = useState(false);
  // Nombres que ya pidieron en la mesa, para cargar "para quién" con un toque.
  const knownNames = [
    ...new Set(session?.orders.flatMap((o) => o.items.map((i) => i.addedBy)).filter((n): n is string => !!n) ?? []),
  ];
  const seats = members.reduce((n, m) => n + m.seats, 0);
  const capacity = members.reduce((n, m) => n + m.maxGuests, 0);
  const [guests, setGuestsLocal] = useState(session?.guests ?? seats);
  const isCashier = CASHIER.includes(me.role);
  const joined = members.length > 1;
  const title = joined ? `Mesas ${groupLabel(members)}` : `Mesa ${table.number}`;
  const style = STATUS_STYLE[session ? (session.status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "OCCUPIED") : table.status];
  // El QR que se muestra es el de la mesa principal (la que tiene la sesión, o la tocada).
  const qrTable = members.find((m) => m.id === session?.tableId) ?? table;

  const run = (fn: () => Promise<{ ok?: string; error?: string } | undefined>) =>
    start(async () => {
      const res = await fn();
      setMsg(res ?? null);
      if (!res?.error) onDone();
    });

  const changeGuests = (n: number) => {
    const next = Math.min(99, Math.max(1, n));
    setGuestsLocal(next);
    if (session) run(() => setGuests(session.id, next));
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="pr-10">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", style.className)}>{style.label}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {areaName} · {seats} sillas · tope {capacity}
          {session && now !== null && (
            <span className="ml-2 inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {elapsed(session.openedAt, now)}
            </span>
          )}
        </p>
      </div>

      {table.status === "DISABLED" ? (
        <p className="rounded-xl bg-ink/5 p-3 text-sm text-muted">
          Mesa deshabilitada. Se habilita desde Admin → Mesas.
        </p>
      ) : (
        <>
          {/* Comensales */}
          {session?.status !== "PENDING_PAYMENT" && (
            <section>
              <p className="mb-2 text-sm font-medium">Comensales</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-line">
                  <button
                    onClick={() => changeGuests(guests - 1)}
                    disabled={guests <= 1 || pending}
                    aria-label="Un comensal menos"
                    className="flex size-12 items-center justify-center disabled:opacity-40"
                  >
                    <Minus className="size-5" aria-hidden />
                  </button>
                  <span className="w-10 text-center text-xl font-bold tabular-nums" aria-live="polite">
                    {guests}
                  </span>
                  <button
                    onClick={() => changeGuests(guests + 1)}
                    disabled={guests >= 99 || pending}
                    aria-label="Un comensal más"
                    className="flex size-12 items-center justify-center disabled:opacity-40"
                  >
                    <Plus className="size-5" aria-hidden />
                  </button>
                </div>
                {guests > capacity && (
                  <p className="flex items-start gap-1.5 text-xs text-warn">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Supera el tope ({capacity}). Sumá una silla o juntá otra mesa.
                  </p>
                )}
              </div>
              {!session && (
                <button
                  onClick={() => run(() => openTable(table.id, guests))}
                  disabled={pending}
                  className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50"
                >
                  Abrir mesa con {guests} {guests === 1 ? "comensal" : "comensales"}
                </button>
              )}
            </section>
          )}

          {/* Mozo */}
          {session && (
            <section>
              <p className="mb-2 text-sm font-medium">Mozo</p>
              {isCashier ? (
                <select
                  value={session.waiterId ?? ""}
                  onChange={(e) => run(() => assignWaiter(session.id, e.target.value || null))}
                  disabled={pending}
                  className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-base sm:text-sm"
                  aria-label="Mozo asignado"
                >
                  <option value="">Sin mozo</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <span className={cn("text-sm", !session.waiterId && "font-medium text-warn")}>
                    {session.waiterId === me.membershipId ? "Vos" : (session.waiterName ?? "Sin mozo")}
                  </span>
                  {!session.waiterId && (
                    <button
                      onClick={() => run(() => assignWaiter(session.id, me.membershipId))}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-ink"
                    >
                      <UserCheck className="size-4" aria-hidden /> Tomar mesa
                    </button>
                  )}
                  {session.waiterId === me.membershipId && (
                    <button
                      onClick={() => run(() => assignWaiter(session.id, null))}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-ink/5"
                    >
                      <UserMinus className="size-4" aria-hidden /> Soltar
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Llama al mozo */}
          {session?.waiterCalledAt && (
            <section className="flex items-center gap-3 rounded-xl bg-warn p-3 text-sm text-white">
              <span className="flex-1 font-semibold">La mesa está llamando al mozo</span>
              <button
                onClick={() => run(() => dismissCall(session.id))}
                disabled={pending}
                className="rounded-lg bg-white/20 px-3 py-1.5 font-medium hover:bg-white/30"
              >
                Ya fui
              </button>
            </section>
          )}

          {/* Tomar pedido (mesa sin celular) */}
          {session?.status === "OPEN" && (
            <button
              onClick={() => setComposing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-ink"
            >
              <NotebookPen className="size-5" aria-hidden /> Tomar pedido
            </button>
          )}

          {/* Pedidos */}
          {session && <OrdersSection session={session} onDone={onDone} />}

          {/* Cierre y cobro */}
          {session && (
            <a
              href={`/staff/cuenta/${session.id}${session.status === "PENDING_PAYMENT" ? "?auto=1" : ""}`}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium",
                session.status === "PENDING_PAYMENT" ? "bg-brand text-brand-ink" : "border border-line hover:bg-ink/5",
              )}
            >
              <Printer className="size-4" aria-hidden />
              {session.status === "PENDING_PAYMENT" ? "Imprimir cuenta" : "Ver / imprimir pre-cuenta"}
            </a>
          )}

          {session?.status === "OPEN" && (
            <section className="space-y-2">
              <button
                onClick={() => run(() => requestClose(session.id))}
                disabled={pending}
                className="h-12 w-full rounded-xl bg-ink font-semibold text-bg disabled:opacity-50"
              >
                Cerrar mesa y pasar a cobrar
              </button>
              {isCashier && (
                <button
                  onClick={() => setPaying(true)}
                  disabled={pending}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ok/50 text-sm font-semibold text-ok hover:bg-ok-soft"
                >
                  <Wallet className="size-4" aria-hidden /> Cobrar ahora (paga en caja)
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm("¿Liberar la mesa sin consumo? (por ejemplo, se abrió por error o se fueron)")) {
                    run(() => releaseTable(session.id));
                  }
                }}
                disabled={pending}
                className="w-full rounded-xl py-2 text-sm text-muted hover:bg-ink/5"
              >
                Liberar sin consumo
              </button>
            </section>
          )}

          {session?.status === "PENDING_PAYMENT" && (
            <section className="space-y-2">
              <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
                Esperando el cobro en caja. El QR de la mesa no acepta pedidos nuevos.
              </p>
              {isCashier && (
                <button
                  onClick={() => setPaying(true)}
                  disabled={pending}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ok font-semibold text-white disabled:opacity-50"
                >
                  <Wallet className="size-5" aria-hidden /> Cobrar
                </button>
              )}
              <button
                onClick={() => run(() => reopenTable(session.id))}
                disabled={pending}
                className="w-full rounded-xl border border-line py-2.5 text-sm hover:bg-ink/5"
              >
                Reabrir (piden algo más)
              </button>
            </section>
          )}

          {/* Mesa extra pegada a esta (llegan más personas de las que entran) */}
          {session?.status !== "PENDING_PAYMENT" &&
            (extraSeats === null ? (
              <button
                onClick={() => setExtraSeats(2)}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand/60 p-3 text-left text-sm hover:bg-brand-soft"
              >
                <SquarePlus className="size-5 shrink-0 text-brand" aria-hidden />
                <span>
                  <span className="block font-medium">Sumar mesa extra</span>
                  <span className="block text-xs text-muted">Traída del depósito o de otro salón. Se quita sola al cobrar.</span>
                </span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/60 bg-brand-soft p-3 text-sm">
                <span className="flex-1 font-medium">Mesa extra de</span>
                <div className="flex items-center rounded-lg border border-line bg-surface">
                  <button onClick={() => setExtraSeats((n) => Math.max(1, (n ?? 2) - 1))} className="p-2" aria-label="Menos sillas">
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{extraSeats}</span>
                  <button onClick={() => setExtraSeats((n) => Math.min(20, (n ?? 2) + 1))} className="p-2" aria-label="Más sillas">
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <span>sillas</span>
                <div className="flex w-full justify-end gap-2">
                  <button onClick={() => setExtraSeats(null)} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const n = extraSeats;
                      setExtraSeats(null);
                      run(() => addExtraTable(areaId, n, table.id));
                    }}
                    disabled={pending}
                    className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-50"
                  >
                    Sumar y juntar
                  </button>
                </div>
              </div>
            ))}

          {/* Juntar / QR */}
          <section className="grid grid-cols-2 gap-2 border-t border-line pt-4">
            {session?.status !== "PENDING_PAYMENT" && (
              <button
                onClick={onJoin}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm hover:bg-ink/5"
              >
                <Link2 className="size-4" aria-hidden /> {joined ? "Sumar mesa" : "Juntar mesas"}
              </button>
            )}
            {joined && session?.status !== "PENDING_PAYMENT" && (
              <button
                onClick={() => run(() => separateTables(table.id))}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm hover:bg-ink/5"
              >
                <Unlink className="size-4" aria-hidden /> Separar
              </button>
            )}
            <button
              onClick={() => setShowQr(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm hover:bg-ink/5"
            >
              <QrCode className="size-4" aria-hidden /> Mostrar QR
            </button>
            <a
              href={`/${slug}/m/${qrTable.qrToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm hover:bg-ink/5"
            >
              <ExternalLink className="size-4" aria-hidden /> Ver como comensal
            </a>
          </section>
        </>
      )}

      {table.temporary && !session && !joined && (
        <button
          onClick={() => run(() => removeExtraTable(table.id))}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm text-danger hover:bg-danger-soft"
        >
          <Trash2 className="size-4" aria-hidden /> Quitar mesa extra
        </button>
      )}

      {msg?.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{msg.error}</p>}
      {msg?.ok && <p className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{msg.ok}</p>}

      {paying && session && (
        <CheckoutDialog
          sessionId={session.id}
          title={title}
          onClose={() => setPaying(false)}
          onDone={() => {
            setMsg({ ok: "Cobrado. Mesa libre." });
            onDone();
          }}
        />
      )}

      {composing && session && (
        <StaffOrderComposer
          sessionId={session.id}
          tableTitle={title}
          menu={menu}
          knownNames={knownNames}
          onClose={() => setComposing(false)}
          onDone={() => {
            setMsg({ ok: "Pedido enviado a cocina" });
            onDone();
          }}
        />
      )}

      {showQr && (
        <QrDialog
          path={`/${slug}/m/${qrTable.qrToken}`}
          title={title}
          venue={venue}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
