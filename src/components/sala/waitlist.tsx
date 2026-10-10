"use client";

import { useState, useTransition } from "react";
import { Armchair, Clock, ListOrdered, Minus, Phone, Plus, UserX, X } from "lucide-react";
import { cn } from "@/lib/format";
import type { SalaReservation, SalaTable, WaitlistItem } from "@/lib/sala";
import { addToWaitlist, leaveWaitlist, seatFromWaitlist } from "@/app/staff/waitlist-actions";
import { elapsed } from "./sala-utils";

type Free = SalaTable & { areaName: string; reservedAt: string | null };

/**
 * Mesas libres para un grupo, de mejor a peor: la más chica en la que entran.
 * `reservedAt`: tiene una reserva que empieza antes de que este grupo termine (se puede usar, pero se avisa).
 */
export function freeTablesFor(
  party: number,
  tables: (SalaTable & { areaName: string })[],
  reservations: SalaReservation[],
  durationMin: number,
  now: number,
): Free[] {
  const until = now + durationMin * 60_000;
  return tables
    .filter((t) => t.status === "FREE" && !t.groupId && t.seats >= party)
    .map((t) => {
      const r = reservations.find((x) => x.tableIds.includes(t.id) && new Date(x.startsAt).getTime() < until);
      return { ...t, reservedAt: r?.startsAt ?? null };
    })
    .sort((a, b) => Number(!!a.reservedAt) - Number(!!b.reservedAt) || a.seats - b.seats);
}

/** Primer grupo de la lista que tiene una mesa libre sin reserva encima (respeta el orden de llegada). */
export function waitlistSuggestion(
  entries: WaitlistItem[],
  tables: (SalaTable & { areaName: string })[],
  reservations: SalaReservation[],
  durationMin: number,
  now: number | null,
) {
  if (now === null) return null;
  for (const e of entries) {
    const table = freeTablesFor(e.party, tables, reservations, durationMin, now).find((t) => !t.reservedAt);
    if (table) return { entry: e, table };
  }
  return null;
}

export function WaitlistPanel({
  entries,
  tables,
  reservations,
  durationMin,
  timezone,
  now,
  onClose,
  onDone,
}: {
  entries: WaitlistItem[];
  tables: (SalaTable & { areaName: string })[];
  reservations: SalaReservation[];
  durationMin: number;
  timezone: string;
  now: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [seating, setSeating] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: string; error?: string } | undefined>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res ?? null);
      if (!res?.error) {
        after?.();
        onDone();
      }
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => addToWaitlist({ name, partySize: party, phone, notes }),
      () => {
        setName("");
        setParty(2);
        setPhone("");
        setNotes("");
      },
    );
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <ListOrdered className="size-4" aria-hidden /> Lista de espera
          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs tabular-nums">{entries.length}</span>
        </h2>
        <button onClick={onClose} aria-label="Cerrar lista de espera" className="rounded-full p-1.5 hover:bg-ink/5">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Anotar */}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          aria-label="Nombre"
          maxLength={40}
          required
          className="h-10 min-w-32 flex-1 rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
        />
        <div className="flex h-10 items-center rounded-lg border border-line">
          <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} className="px-2.5" aria-label="Una persona menos">
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-6 text-center font-semibold tabular-nums" aria-label="Personas">
            {party}
          </span>
          <button type="button" onClick={() => setParty((p) => Math.min(50, p + 1))} className="px-2.5" aria-label="Una persona más">
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono (opc.)"
          aria-label="Teléfono"
          type="tel"
          maxLength={20}
          className="h-10 w-36 rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota (opc.): terraza, carrito…"
          aria-label="Nota"
          maxLength={140}
          className="h-10 min-w-40 flex-1 rounded-lg border border-line bg-surface px-3 text-base sm:text-sm"
        />
        <button type="submit" disabled={pending || !name.trim()} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-50">
          Anotar
        </button>
      </form>
      {msg?.error && <p className="text-sm text-danger">{msg.error}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-muted">Nadie esperando. Anotá a quien llega sin reserva y no hay mesa.</p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line">
          {entries.map((e, i) => {
            const options = now === null ? [] : freeTablesFor(e.party, tables, reservations, durationMin, now);
            return (
              <li key={e.id} className="p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-sm font-bold tabular-nums">{i + 1}</span>
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">{e.name}</span> · {e.party} {e.party === 1 ? "persona" : "personas"}
                    {e.notes && <span className="block text-xs text-muted">{e.notes}</span>}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted" title="Esperando desde">
                    <Clock className="size-3.5" aria-hidden /> {elapsed(e.createdAt, now)}
                  </span>
                  {e.phone && (
                    <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                      <Phone className="size-3.5" aria-hidden /> {e.phone}
                    </a>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSeating(seating === e.id ? null : e.id)}
                      disabled={pending}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
                        options.length ? "bg-ok text-white" : "border border-line text-muted",
                      )}
                    >
                      <Armchair className="size-4" aria-hidden /> Sentar
                    </button>
                    <button
                      onClick={() => run(() => leaveWaitlist(e.id))}
                      disabled={pending}
                      title="Se fue"
                      aria-label={`${e.name} se fue`}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-line hover:bg-ink/5"
                    >
                      <UserX className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
                {seating === e.id && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options.length === 0 ? (
                      <p className="text-sm text-muted">No hay una mesa libre donde entren. Juntá mesas desde el plano o esperá que se libere una.</p>
                    ) : (
                      options.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => run(() => seatFromWaitlist(e.id, t.id), () => setSeating(null))}
                          disabled={pending}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm",
                            t.reservedAt ? "border-warn/50 text-warn" : "border-line hover:border-ok hover:bg-ok-soft",
                          )}
                          title={t.reservedAt ? "Tiene una reserva enseguida" : undefined}
                        >
                          Mesa {t.number} <span className="text-xs opacity-70">· {t.seats} · {t.areaName}</span>
                          {t.reservedAt && (
                            <span className="block text-[11px]">
                              Reservada{" "}
                              {new Date(t.reservedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: timezone })}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted">Mientras haya gente esperando, la web no ofrece horarios cercanos (se ajusta en Reservas → Configuración).</p>
    </section>
  );
}
