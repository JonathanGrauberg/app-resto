import "server-only";

/**
 * Reglas comunes para armar una línea de pedido (comensal o mozo):
 * las opciones elegidas deben ser de los grupos del plato y respetar mínimos/máximos.
 * Si el grupo permite repetir, la misma opción puede venir varias veces (2 bochas de chocolate).
 * Precios y nombres siempre salen de la base, nunca del cliente.
 */

type Group = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  allowRepeat: boolean;
  options: { id: string; name: string; extraPriceCents: number; available: boolean }[];
};

type Link = { minSelect: number | null; maxSelect: number | null; group: Group };

/** Grupos del producto con la cantidad propia de ese producto (ej. "Gustos": ¼ kg hasta 3). */
export const productGroups = (links: Link[]): Group[] =>
  links.map((l) => ({ ...l.group, minSelect: l.minSelect ?? l.group.minSelect, maxSelect: l.maxSelect ?? l.group.maxSelect }));

export type Modifier = { groupId: string; groupName: string; optionId: string; name: string; extraPriceCents: number };

export function buildModifiers(groups: Group[], optionIds: string[]): { modifiers: Modifier[] } | { error: string } {
  const modifiers: Modifier[] = [];
  const times = (id: string) => optionIds.filter((x) => x === id).length;
  for (const group of groups) {
    const chosen = group.options.flatMap((o) => Array.from({ length: times(o.id) }, () => o));
    const label = group.name.toLowerCase();
    if (chosen.length < group.minSelect) return { error: group.minSelect === 1 ? `Elegí ${label}` : `En ${label} elegí ${group.minSelect}` };
    if (chosen.length > group.maxSelect) return { error: `En ${label} se puede elegir hasta ${group.maxSelect}` };
    if (!group.allowRepeat && chosen.length !== new Set(chosen.map((o) => o.id)).size) return { error: `En ${label} no se puede repetir` };
    const out = chosen.find((o) => !o.available);
    if (out) return { error: `${out.name} se terminó, elegí otra opción` };
    for (const o of chosen) {
      modifiers.push({ groupId: group.id, groupName: group.name, optionId: o.id, name: o.name, extraPriceCents: o.extraPriceCents });
    }
  }
  if (modifiers.length !== optionIds.length) return { error: "Opción no válida" };
  return { modifiers };
}

export const unitPrice = (basePriceCents: number, modifiers: { extraPriceCents: number }[]) =>
  basePriceCents + modifiers.reduce((n, m) => n + m.extraPriceCents, 0);
