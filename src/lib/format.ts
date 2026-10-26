export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Normaliza para búsqueda: minúsculas y sin tildes. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Nombres de opciones elegidas, juntando repetidas: ["Chocolate", "Chocolate", "Frutilla"] → ["Chocolate ×2", "Frutilla"]. */
export function modifierLabels(mods: { name: string }[] | null | undefined): string[] {
  const counts = new Map<string, number>();
  for (const m of mods ?? []) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
}
