import type { ModuleKey } from "@/generated/prisma/enums";

/**
 * Planes: combinaciones de módulos para dar de alta un local rápido.
 * Los precios se definen más adelante (cobro del SaaS); acá solo qué incluye cada uno.
 * Siempre se puede ajustar módulo por módulo desde la ficha del local.
 */
export const PLANS: { id: string; label: string; description: string; modules: ModuleKey[] }[] = [
  {
    id: "carta",
    label: "Carta",
    description: "Carta digital con QR por mesa. Para empezar.",
    modules: ["CARTA_QR"],
  },
  {
    id: "salon",
    label: "Salón",
    description: "Carta, pedidos desde la mesa, mozos, cocina y barra, y caja.",
    modules: ["CARTA_QR", "PEDIDOS", "KDS", "CAJA"],
  },
  {
    id: "completo",
    label: "Completo",
    description: "Todo lo del Salón, más reservas, métricas y compras.",
    modules: ["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "RESERVAS", "BI", "COMPRAS"],
  },
];

/** Plan que coincide exactamente con estos módulos (o null si es una combinación a medida). */
export function planOf(modules: Iterable<ModuleKey>) {
  const set = new Set(modules);
  return PLANS.find((p) => p.modules.length === set.size && p.modules.every((m) => set.has(m))) ?? null;
}
