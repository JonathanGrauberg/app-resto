"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import type { SalaSession, SalaTable } from "@/lib/sala";

export type Me = { membershipId: string; roles: Role[] };

/** Agrupa mesas juntadas: devuelve, por mesa, las mesas de su grupo (ordenadas por número). */
export function groupMembers(tables: SalaTable[], t: SalaTable) {
  if (!t.groupId) return [t];
  return tables
    .filter((x) => x.groupId === t.groupId)
    .sort((a, b) => a.number.localeCompare(b.number, "es", { numeric: true }));
}

export const groupLabel = (members: SalaTable[]) => members.map((m) => m.number).join("+");

export function sessionFor(sessions: SalaSession[], members: SalaTable[]) {
  return sessions.find((s) => members.some((m) => m.id === s.tableId)) ?? null;
}

/** "hace 12 min" sin romper la hidratación: el reloj arranca después de montar. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function elapsed(fromIso: string, now: number | null) {
  if (now === null) return "";
  const min = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}


/** Colores del reloj de mesa: verde y, cada 30 min, un paso más hacia el rojo (desde 2 h, rojo). */
const WAIT_COLORS = ["#16a34a", "#65a30d", "#ca8a04", "#ea580c", "#dc2626"];

export function minutesSince(fromIso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
}

export function waitColor(min: number) {
  return WAIT_COLORS[Math.min(WAIT_COLORS.length - 1, Math.floor(min / 30))];
}

/** Formato corto para el plano: "45′", "1h05". */
export function shortMinutes(min: number) {
  return min < 60 ? `${min}′` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}
