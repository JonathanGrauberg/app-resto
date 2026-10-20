/** Categorías de compra (cliente y servidor). */
export const PURCHASE_CATEGORIES = [
  { value: "FOOD", label: "Mercadería" },
  { value: "DRINKS", label: "Bebidas" },
  { value: "SUPPLIES", label: "Limpieza e insumos" },
  { value: "OTHER", label: "Otros" },
] as const;

export type PurchaseCategoryValue = (typeof PURCHASE_CATEGORIES)[number]["value"];

export const PURCHASE_CATEGORY_LABEL = Object.fromEntries(PURCHASE_CATEGORIES.map((c) => [c.value, c.label])) as Record<
  PurchaseCategoryValue,
  string
>;
