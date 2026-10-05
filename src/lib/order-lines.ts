import "server-only";

/**
 * Reglas comunes para armar una línea de pedido (comensal o mozo):
 * las opciones elegidas deben ser de los grupos del plato y respetar mínimos/máximos.
 * Precios y nombres siempre salen de la base, nunca del cliente.
 */

type Group = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { id: string; name: string; extraPriceCents: number }[];
};

export type Modifier = { groupId: string; groupName: string; optionId: string; name: string; extraPriceCents: number };

export function buildModifiers(groups: Group[], optionIds: string[]): { modifiers: Modifier[] } | { error: string } {
  const modifiers: Modifier[] = [];
  for (const group of groups) {
    const chosen = group.options.filter((o) => optionIds.includes(o.id));
    if (chosen.length < group.minSelect) return { error: `Elegí ${group.name.toLowerCase()}` };
    if (chosen.length > group.maxSelect) return { error: `En ${group.name.toLowerCase()} se puede elegir hasta ${group.maxSelect}` };
    for (const o of chosen) {
      modifiers.push({ groupId: group.id, groupName: group.name, optionId: o.id, name: o.name, extraPriceCents: o.extraPriceCents });
    }
  }
  if (modifiers.length !== new Set(optionIds).size) return { error: "Opción no válida" };
  return { modifiers };
}

export const unitPrice = (basePriceCents: number, modifiers: { extraPriceCents: number }[]) =>
  basePriceCents + modifiers.reduce((n, m) => n + m.extraPriceCents, 0);
