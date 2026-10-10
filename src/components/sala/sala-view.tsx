"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Armchair, BellRing, CalendarClock, Link2, ListOrdered, Plus, Users, X } from "lucide-react";
import { STATUS_STYLE, TableLegend } from "@/components/table-map";
import { cn } from "@/lib/format";
import type { PublicMenu } from "@/lib/public-menu";
import type { SalaData, SalaReservation, SalaTable } from "@/lib/sala";
import { addExtraTable, joinTables } from "@/app/staff/sala-actions";
import { TablePanel } from "./table-panel";
import { WaitlistPanel, waitlistSuggestion } from "./waitlist";
import { seatFromWaitlist } from "@/app/staff/waitlist-actions";
import { elapsed, groupLabel, groupMembers, minutesSince, sessionFor, shortMinutes, useNow, waitColor, type Me } from "./sala-utils";

export function SalaView({
  data,
  me,
  slug,
  venue,
  menu,
}: {
  data: SalaData;
  me: Me;
  slug: string;
  venue: string;
  /** Carta, para que el mozo tome pedidos desde el panel de la mesa. */
  menu: PublicMenu;
}) {
  const router = useRouter();
  const now = useNow();
  const [areaId, setAreaId] = useState(data.areas[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joinSel, setJoinSel] = useState<string[] | null>(null); // modo "juntar"
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, startJoin] = useTransition();
  const [extraSeats, setExtraSeats] = useState<number | null>(null); // formulario "mesa extra" suelta
  const [extraMsg, setExtraMsg] = useState<string | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [seatMsg, setSeatMsg] = useState<string | null>(null);

  // La actualización en vivo la hace <StaffLive> (en el layout), con respaldo periódico si se corta.

  const allTables = useMemo(() => data.areas.flatMap((a) => a.tables), [data.areas]);
  const tablesWithArea = useMemo(() => data.areas.flatMap((a) => a.tables.map((t) => ({ ...t, areaName: a.name }))), [data.areas]);
  // Mesa libre que le sirve al primero de la lista que entra (sin reserva encima).
  const suggestion = waitlistSuggestion(data.waitlist, tablesWithArea, data.reservations, data.bookingDurationMin, now);
  const area = data.areas.find((a) => a.id === areaId) ?? data.areas[0];
  const selected = allTables.find((t) => t.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const free = allTables.filter((t) => t.status === "FREE").length;
    const pending = data.sessions.filter((s) => s.status === "PENDING_PAYMENT").length;
    const open = data.sessions.filter((s) => s.status === "OPEN").length;
    const guests = data.sessions.reduce((n, s) => n + s.guests, 0);
    const noWaiter = data.sessions.filter((s) => s.status === "OPEN" && !s.waiterId).length;
    const toAccept = data.sessions.reduce((n, s) => n + s.pendingOrders, 0);
    const calling = data.sessions.filter((s) => s.waiterCalledAt).length;
    const toDeliver = data.sessions.reduce((n, s) => n + s.readyItems, 0);
    const booked = data.reservations.length;
    return { free, pending, open, guests, noWaiter, toAccept, calling, toDeliver, booked };
  }, [allTables, data.sessions]);

  if (!area) {
    return <p className="text-muted">Todavía no hay salones. Se crean desde Admin → Mesas.</p>;
  }

  const onTableClick = (t: SalaTable) => {
    if (joinSel) {
      if (t.status === "DISABLED" || t.status === "PENDING_PAYMENT") return;
      const ids = groupMembers(allTables, t).map((m) => m.id);
      setJoinSel((prev) => {
        const cur = prev ?? [];
        const has = ids.every((i) => cur.includes(i));
        return has ? cur.filter((i) => !ids.includes(i)) : [...new Set([...cur, ...ids])];
      });
      return;
    }
    setSelectedId(t.id);
  };

  const startJoinMode = (t: SalaTable) => {
    setJoinError(null);
    setJoinSel(groupMembers(allTables, t).map((m) => m.id));
  };

  const confirmJoin = () =>
    startJoin(async () => {
      const res = await joinTables(joinSel ?? []);
      if (res?.error) return setJoinError(res.error);
      setJoinSel(null);
      router.refresh();
    });

  // Contorno común para mesas juntadas que están pegadas en el plano.
  const groupBoxes = (() => {
    const byGroup = new Map<string, SalaTable[]>();
    for (const t of area.tables) if (t.groupId) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);
    return [...byGroup.values()].flatMap((members) => {
      const x1 = Math.min(...members.map((m) => m.posX));
      const y1 = Math.min(...members.map((m) => m.posY));
      const x2 = Math.max(...members.map((m) => m.posX + m.width));
      const y2 = Math.max(...members.map((m) => m.posY + m.height));
      const intruder = area.tables.some(
        (o) => !members.includes(o) && o.posX < x2 && x1 < o.posX + o.width && o.posY < y2 && y1 < o.posY + o.height,
      );
      if (intruder) return [];
      return [{ key: members[0].groupId!, x1, y1, x2, y2, label: groupLabel(groupMembers(allTables, members[0])) }];
    });
  })();

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          <strong className="tabular-nums">{stats.open}</strong> <span className="text-muted">ocupadas</span>
        </span>
        <span>
          <strong className="tabular-nums">{stats.free}</strong> <span className="text-muted">libres</span>
        </span>
        <span>
          <strong className="tabular-nums">{stats.pending}</strong> <span className="text-muted">por cobrar</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-4 text-muted" aria-hidden /> <strong className="tabular-nums">{stats.guests}</strong>{" "}
          <span className="text-muted">comensales</span>
        </span>
        {stats.toAccept > 0 && (
          <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
            {stats.toAccept} {stats.toAccept === 1 ? "pedido" : "pedidos"} por aceptar
          </span>
        )}
        {stats.toDeliver > 0 && (
          <span className="rounded-full bg-ok px-2.5 py-0.5 text-xs font-semibold text-white">
            {stats.toDeliver} {stats.toDeliver === 1 ? "plato listo" : "platos listos"} para llevar
          </span>
        )}
        {stats.calling > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn px-2.5 py-0.5 text-xs font-semibold text-white">
            <BellRing className="size-3" aria-hidden /> {stats.calling} {stats.calling === 1 ? "mesa llama" : "mesas llaman"}
          </span>
        )}
        {stats.booked > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
            <CalendarClock className="size-3" aria-hidden /> {stats.booked} {stats.booked === 1 ? "reserva próxima" : "reservas próximas"}
          </span>
        )}
        {stats.noWaiter > 0 && (
          <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
            {stats.noWaiter} sin mozo
          </span>
        )}
        <div className="ml-auto hidden flex-wrap items-center gap-3 md:flex">
          <TableLegend />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted" title="Cada 30 min cambia de color">
            <span className="h-3 w-10 rounded-full bg-[linear-gradient(90deg,#16a34a,#65a30d,#ca8a04,#ea580c,#dc2626)]" />
            Desde el 1.er pedido
          </span>
        </div>
      </div>

      {/* Salones */}
      <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Salones">
        {data.areas.map((a) => {
          const busy = a.tables.filter((t) => t.status === "OCCUPIED" || t.status === "PENDING_PAYMENT").length;
          return (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === area.id}
              onClick={() => setAreaId(a.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm",
                a.id === area.id ? "bg-ink text-bg" : "bg-surface ring-1 ring-line hover:ring-ink/30",
              )}
            >
              {a.name}{" "}
              <span className="opacity-60">
                · {busy}/{a.tables.length}
              </span>
            </button>
          );
        })}
      </div>
        <button
          onClick={() => setShowWaitlist((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ring-1",
            data.waitlist.length ? "bg-warn-soft font-semibold text-warn ring-warn/40" : "ring-line hover:ring-ink/30",
          )}
        >
          <ListOrdered className="size-4" aria-hidden /> Lista de espera
          {data.waitlist.length > 0 && <span className="tabular-nums">· {data.waitlist.length}</span>}
        </button>
        <button
          onClick={() => {
            setExtraMsg(null);
            setExtraSeats(2);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ring-1 ring-line hover:ring-ink/30"
        >
          <Plus className="size-4" aria-hidden /> Mesa extra
        </button>
      </div>

      {suggestion && !joinSel && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ok/50 bg-ok-soft/60 p-3 text-sm">
          <Armchair className="size-4 text-ok" aria-hidden />
          <span className="flex-1">
            <strong>Mesa {suggestion.table.number}</strong> libre ({suggestion.table.seats} sillas) →{" "}
            <strong>{suggestion.entry.name}</strong> ({suggestion.entry.party}), en la lista de espera
            {data.waitlist[0]?.id !== suggestion.entry.id && " (los primeros no entran en esa mesa)"}
          </span>
          {seatMsg && <span className="w-full text-danger">{seatMsg}</span>}
          <button
            onClick={() =>
              startJoin(async () => {
                const res = await seatFromWaitlist(suggestion.entry.id, suggestion.table.id);
                setSeatMsg(res?.error ?? null);
                router.refresh();
              })
            }
            disabled={joining}
            className="rounded-lg bg-ok px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Sentar
          </button>
        </div>
      )}

      {showWaitlist && (
        <WaitlistPanel
          entries={data.waitlist}
          tables={tablesWithArea}
          reservations={data.reservations}
          durationMin={data.bookingDurationMin}
          timezone={data.timezone}
          now={now}
          onClose={() => setShowWaitlist(false)}
          onDone={() => router.refresh()}
        />
      )}

      {extraSeats !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-sm">
          <span className="flex-1">
            Nueva mesa extra en <strong>{area.name}</strong> (por ejemplo, traída del depósito). Se quita sola al cobrarla.
          </span>
          <label className="flex items-center gap-2">
            Sillas
            <input
              type="number"
              min={1}
              max={20}
              value={extraSeats}
              onChange={(e) => setExtraSeats(Number(e.target.value) || 1)}
              className="h-10 w-16 rounded-lg border border-line bg-surface px-2 text-center"
            />
          </label>
          {extraMsg && <span className="w-full text-danger">{extraMsg}</span>}
          <button onClick={() => setExtraSeats(null)} className="rounded-lg px-3 py-2 hover:bg-ink/5">
            Cancelar
          </button>
          <button
            onClick={() =>
              startJoin(async () => {
                const res = await addExtraTable(area.id, extraSeats);
                if (res?.error) return setExtraMsg(res.error);
                setExtraSeats(null);
                router.refresh();
              })
            }
            disabled={joining}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      )}

      {joinSel && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand bg-brand-soft p-3 text-sm">
          <Link2 className="size-4 text-brand" aria-hidden />
          <span className="flex-1">
            Tocá las mesas que querés juntar.{" "}
            <strong>
              {joinSel.length >= 2
                ? allTables
                    .filter((t) => joinSel.includes(t.id))
                    .map((t) => t.number)
                    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
                    .join("+")
                : "Elegí al menos una más"}
            </strong>
          </span>
          {joinError && <span className="w-full text-danger">{joinError}</span>}
          <button onClick={() => setJoinSel(null)} className="rounded-lg px-3 py-2 hover:bg-ink/5">
            Cancelar
          </button>
          <button
            onClick={confirmJoin}
            disabled={joinSel.length < 2 || joining}
            className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-50"
          >
            {joining ? "Juntando…" : "Juntar"}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Plano */}
        <div className="rounded-2xl border border-line bg-surface">
          <div className="relative w-full" style={{ aspectRatio: `${area.width} / ${area.height}` }}>
            {groupBoxes.map((b) => (
              <div
                key={b.key}
                className="pointer-events-none absolute rounded-2xl border-2 border-dashed border-brand/70 bg-brand-soft/60"
                style={{
                  left: `calc(${(b.x1 / area.width) * 100}% - 4px)`,
                  top: `calc(${(b.y1 / area.height) * 100}% - 4px)`,
                  width: `calc(${((b.x2 - b.x1) / area.width) * 100}% + 8px)`,
                  height: `calc(${((b.y2 - b.y1) / area.height) * 100}% + 8px)`,
                }}
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-ink">
                  {b.label}
                </span>
              </div>
            ))}

            {area.tables.map((t) => {
              const members = groupMembers(allTables, t);
              const session = sessionFor(data.sessions, members);
              const style = STATUS_STYLE[t.status];
              const capacity = members.reduce((n, m) => n + m.seats, 0);
              const waited = session?.firstOrderAt && now !== null ? minutesSince(session.firstOrderAt, now) : null;
              const booking = reservationFor(data.reservations, members);
              const bookingTime = booking ? hhmm(booking.startsAt, data.timezone) : null;
              const isSel = selected && groupMembers(allTables, selected).some((m) => m.id === t.id);
              const inJoin = joinSel?.includes(t.id);
              const mine = session?.waiterId === me.membershipId;
              return (
                <button
                  key={t.id}
                  onClick={() => onTableClick(t)}
                  aria-label={`Mesa ${t.number}, ${style.label}${session ? `, ${session.guests} comensales` : ""}`}
                  className={cn(
                    "group absolute flex flex-col items-center justify-center border-2 text-center leading-tight shadow-sm transition-transform hover:scale-[1.04]",
                    t.shape === "ROUND" ? "rounded-full" : "rounded-xl",
                    style.className,
                    t.temporary && "border-dashed",
                    isSel && "ring-4 ring-brand/50",
                    inJoin && "ring-4 ring-brand",
                    joinSel && !inJoin && (t.status === "DISABLED" || t.status === "PENDING_PAYMENT") && "opacity-40",
                  )}
                  style={{
                    left: `${(t.posX / area.width) * 100}%`,
                    top: `${(t.posY / area.height) * 100}%`,
                    width: `${(t.width / area.width) * 100}%`,
                    height: `${(t.height / area.height) * 100}%`,
                  }}
                >
                  <span className="text-[clamp(10px,1.8vw,16px)] font-semibold">{t.number}</span>
                  {session ? (
                    <span className={cn("text-[10px] tabular-nums", session.guests > capacity && "font-bold text-warn")}>
                      {session.guests}/{capacity}
                    </span>
                  ) : (
                    <span className="hidden text-[10px] opacity-70 sm:block">{t.seats} p.</span>
                  )}
                  {session && session.pendingOrders > 0 ? (
                    <span
                      className="absolute -right-2 -top-2 flex min-w-5 animate-pulse items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-surface"
                      title="Pedidos por aceptar"
                    >
                      {session.pendingOrders}
                    </span>
                  ) : (
                    session &&
                    !session.waiterId &&
                    session.status === "OPEN" && (
                      <span className="absolute -right-1 -top-1 size-3 rounded-full bg-warn ring-2 ring-surface" title="Sin mozo" />
                    )
                  )}
                  {session && session.readyItems > 0 && (
                    <span
                      className="absolute -left-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-ok px-1 text-[11px] font-bold text-white ring-2 ring-surface"
                      title="Platos listos para llevar"
                    >
                      {session.readyItems}
                    </span>
                  )}
                  {waited !== null && (
                    <span
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-bold leading-[18px] tabular-nums text-white ring-2 ring-surface"
                      style={{ backgroundColor: waitColor(waited) }}
                      title="Tiempo desde el primer pedido"
                    >
                      {shortMinutes(waited)}
                    </span>
                  )}
                  {session?.waiterCalledAt && (
                    <span
                      className="absolute -bottom-2 -right-2 flex size-6 animate-bounce items-center justify-center rounded-full bg-warn text-white ring-2 ring-surface"
                      title="Llama al mozo"
                    >
                      <BellRing className="size-3.5" aria-hidden />
                    </span>
                  )}
                  {mine && <span className="absolute -left-1 -top-1 size-3 rounded-full bg-ok ring-2 ring-surface" title="Tu mesa" />}
                  {booking && (
                    <span
                      className={cn(
                        "absolute -bottom-2 -left-2 flex items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold leading-[18px] tabular-nums ring-2 ring-surface",
                        // Mesa ocupada con una reserva encima: se avisa en ámbar.
                        session ? "bg-warn text-white" : "bg-brand text-brand-ink",
                      )}
                      title={`Reservada ${bookingTime} · ${booking.name} (${booking.party})`}
                    >
                      <CalendarClock className="size-3" aria-hidden /> {bookingTime}
                    </span>
                  )}

                  {/* Tooltip (solo dispositivos con mouse) */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-52 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-left text-xs text-bg shadow-lg [@media(hover:hover)]:group-hover:block">
                    <span className="block font-semibold">
                      {members.length > 1 ? `Mesas ${groupLabel(members)}` : `Mesa ${t.number}`} · {style.label}
                    </span>
                    {t.temporary && <span className="block opacity-70">Mesa extra (temporal)</span>}
                    {!t.onlineBookable && <span className="block opacity-70">Sin reserva online</span>}
                    {booking && (
                      <span className="block font-medium">
                        Reserva {bookingTime} · {booking.name} ({booking.party})
                      </span>
                    )}
                    {session ? (
                      <>
                        <span className="block">
                          {session.guests} comensales · {capacity} sillas
                        </span>
                        <span className="block">Mozo: {session.waiterName ?? "sin asignar"}</span>
                        {now !== null && <span className="block opacity-70">Abierta hace {elapsed(session.openedAt, now)}</span>}
                        {waited !== null && <span className="block opacity-70">Primer pedido hace {elapsed(session.firstOrderAt!, now)}</span>}
                      </>
                    ) : (
                      <span className="block">
                        {t.seats} sillas
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel: columna en PC/tablet ancha, hoja inferior en celular */}
        {selected && !joinSel ? (
          <>
            <button
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              aria-label="Cerrar"
              onClick={() => setSelectedId(null)}
            />
            <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:sticky lg:top-20 lg:z-auto lg:max-h-none lg:rounded-2xl lg:border lg:border-line lg:shadow-none">
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Cerrar panel"
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full hover:bg-ink/5"
              >
                <X className="size-5" aria-hidden />
              </button>
              <TablePanel
                key={selected.id}
                table={selected}
                members={groupMembers(allTables, selected)}
                session={sessionFor(data.sessions, groupMembers(allTables, selected))}
                reservation={reservationFor(data.reservations, groupMembers(allTables, selected))}
                timezone={data.timezone}
                areaName={data.areas.find((a) => a.tables.some((t) => t.id === selected.id))?.name ?? ""}
                waiters={data.waiters}
                me={me}
                now={now}
                slug={slug}
                venue={venue}
                areaId={data.areas.find((a) => a.tables.some((t) => t.id === selected.id))?.id ?? area.id}
                menu={menu}
                onJoin={() => startJoinMode(selected)}
                onDone={() => router.refresh()}
              />
            </div>
          </>
        ) : (
          <div className="hidden rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted lg:block">
            Tocá una mesa para ver sus comensales, el mozo, el QR y las acciones.
          </div>
        )}
      </div>
    </div>
  );
}

/** Próxima reserva de una mesa (o de alguna de las juntadas). */
function reservationFor(list: SalaReservation[], members: SalaTable[]) {
  return list.find((r) => r.tableIds.some((id) => members.some((m) => m.id === id))) ?? null;
}

const hhmm = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
