"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/generated/prisma/enums";
import type { SalaSession, SalaTable } from "@/lib/sala";

export type Me = { membershipId: string; role: Role };

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

