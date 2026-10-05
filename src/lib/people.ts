/**
 * Agrupa ítems por la persona que los pidió (apodo del comensal).
 * Con `myId`, los propios se etiquetan "Vos" y van primero; los cargados por el mozo, "Mozo".
 */
export function groupByPerson<T extends { addedBy: string | null; addedById: string | null }>(
  items: T[],
  myId?: string | null,
) {
  const groups = new Map<string, { label: string; mine: boolean; items: T[] }>();
  for (const item of items) {
    const key = item.addedById ?? item.addedBy ?? "_mesa";
    const mine = !!myId && item.addedById === myId;
    const label = mine ? "Vos" : (item.addedBy ?? "Mozo");
    const g = groups.get(key) ?? { label, mine, items: [] };
    g.items.push(item);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.mine ? -1 : b.mine ? 1 : a.label.localeCompare(b.label, "es")));
}

/** "Vos, Ana y Tito" */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
