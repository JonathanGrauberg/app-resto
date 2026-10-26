"use client";

import { useState } from "react";
import type { PublicProduct } from "@/lib/public-menu";

type Group = PublicProduct["modifierGroups"][number];

/**
 * Lo que va eligiendo el comensal (o el mozo) en un plato con opciones.
 * En grupos que permiten repetir, la misma opción aparece varias veces (2 bochas de chocolate).
 */
export function useOptionSelection(groups: Group[]) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const chosen = (g: Group) => sel[g.id] ?? [];
  const times = (g: Group, optionId: string) => chosen(g).filter((x) => x === optionId).length;

  /** Elegir / quitar (grupos sin repetición). Con máximo 1 funciona como radio. */
  const toggle = (g: Group, optionId: string) =>
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((o) => o !== optionId) };
      if (g.maxSelect === 1) return { ...prev, [g.id]: [optionId] };
      if (cur.length >= g.maxSelect) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  /** Sumar una más de esa opción (grupos con repetición). */
  const add = (g: Group, optionId: string) =>
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      return cur.length >= g.maxSelect ? prev : { ...prev, [g.id]: [...cur, optionId] };
    });
  /** Sacar una de esa opción. */
  const remove = (g: Group, optionId: string) =>
    setSel((prev) => {
      const cur = [...(prev[g.id] ?? [])];
      const i = cur.lastIndexOf(optionId);
      if (i >= 0) cur.splice(i, 1);
      return { ...prev, [g.id]: cur };
    });

  const extrasCents = groups.reduce((n, g) => n + chosen(g).reduce((m, id) => m + (g.options.find((o) => o.id === id)?.extraPriceCents ?? 0), 0), 0);
  return {
    chosen,
    times,
    toggle,
    add,
    remove,
    extrasCents,
    missing: groups.some((g) => chosen(g).length < g.minSelect),
    optionIds: Object.values(sel).flat(),
  };
}

/** Ayuda junto al nombre del grupo: "Elegí 3", "Obligatorio · hasta 3", "Opcional". */
export function groupHint(g: Group, picked: number) {
  const base =
    g.minSelect > 1 && g.minSelect === g.maxSelect
      ? `Elegí ${g.minSelect}`
      : `${g.minSelect > 0 ? "Obligatorio" : "Opcional"}${g.maxSelect > 1 ? ` · hasta ${g.maxSelect}` : ""}`;
  return g.maxSelect > 1 && picked > 0 ? `${base} · ${picked} de ${g.maxSelect}` : base;
}
