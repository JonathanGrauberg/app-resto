const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number) {
  return eur.format(cents / 100);
}

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
