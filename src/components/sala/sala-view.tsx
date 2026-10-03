"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Link2, Plus, Users, X } from "lucide-react";
import { STATUS_STYLE, TableLegend } from "@/components/table-map";
import { cn } from "@/lib/format";
import type { SalaData, SalaTable } from "@/lib/sala";
import { addExtraTable, joinTables } from "@/app/staff/sala-actions";
import { TablePanel } from "./table-panel";
import { elapsed, groupLabel, groupMembers, sessionFor, useNow, type Me } from "./sala-utils";

export function SalaView({
  data,
  me,
  slug,
  venue,
}: {
  data: SalaData;
  me: Me;
  slug: string;
  venue: string;
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

  // Hasta tener tiempo real (Fase 3), la sala se refresca sola cada 10 s si la pestaña está visible.
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [router]);

  const allTables = useMemo(() => data.areas.flatMap((a) => a.tables), [data.areas]);
  const area = data.areas.find((a) => a.id === areaId) ?? data.areas[0];
  const selected = allTables.find((t) => t.id === selectedId) ?? null;

  const stats = useMemo(() => {
    const free = allTables.filter((t) => t.status === "FREE").length;
    const pending = data.sessions.filter((s) => s.status === "PENDING_PAYMENT").length;
    const open = data.sessions.filter((s) => s.status === "OPEN").length;
    const guests = data.sessions.reduce((n, s) => n + s.guests, 0);
    const noWaiter = data.sessions.filter((s) => s.status === "OPEN" && !s.waiterId).length;
    return { free, pending, open, guests, noWaiter };
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
        {stats.noWaiter > 0 && (
          <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
            {stats.noWaiter} sin mozo
          </span>
        )}
        <div className="ml-auto hidden md:block">
          <TableLegend />
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
          onClick={() => {
            setExtraMsg(null);
            setExtraSeats(2);
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ring-1 ring-line hover:ring-ink/30"
        >
          <Plus className="size-4" aria-hidden /> Mesa extra
        </button>
      </div>

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
              const capacity = members.reduce((n, m) => n + m.maxGuests, 0);
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
                  {session && !session.waiterId && session.status === "OPEN" && (
                    <span className="absolute -right-1 -top-1 size-3 rounded-full bg-warn ring-2 ring-surface" title="Sin mozo" />
                  )}
                  {mine && <span className="absolute -left-1 -top-1 size-3 rounded-full bg-ok ring-2 ring-surface" title="Tu mesa" />}

                  {/* Tooltip (solo dispositivos con mouse) */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-52 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-left text-xs text-bg shadow-lg [@media(hover:hover)]:group-hover:block">
                    <span className="block font-semibold">
                      {members.length > 1 ? `Mesas ${groupLabel(members)}` : `Mesa ${t.number}`} · {style.label}
                    </span>
                    {t.temporary && <span className="block opacity-70">Mesa extra (temporal)</span>}
                    {session ? (
                      <>
                        <span className="block">
                          {session.guests} comensales (tope {capacity})
                        </span>
                        <span className="block">Mozo: {session.waiterName ?? "sin asignar"}</span>
                        {now !== null && <span className="block opacity-70">Hace {elapsed(session.openedAt, now)}</span>}
                      </>
                    ) : (
                      <span className="block">
                        {t.seats} sillas · tope {t.maxGuests}
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
                areaName={data.areas.find((a) => a.tables.some((t) => t.id === selected.id))?.name ?? ""}
                waiters={data.waiters}
                me={me}
                now={now}
                slug={slug}
                venue={venue}
                areaId={data.areas.find((a) => a.tables.some((t) => t.id === selected.id))?.id ?? area.id}
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
