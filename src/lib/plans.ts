import type { ModuleKey } from "@/generated/prisma/enums";

/**
 * Planes: combinaciones de módulos.
 * - Gratis (id "carta"): con el que arranca quien se registra solo en la web.
 * - Salón y Pro: se activan con un código PRO que les damos al cerrar la venta (hasta tener Mercado Pago).
 * - Chamullame solo: para boliches y eventos.
 * Los ids no cambian (están guardados en las suscripciones); los nombres sí se pueden cambiar.
 * Siempre se puede ajustar módulo por módulo desde la ficha del local.
 */
export const PLANS: { id: string; label: string; description: string; modules: ModuleKey[] }[] = [
  {
    id: "carta",
    label: "Gratis",
    description: "Carta digital con QR por mesa y página de enlaces. Para empezar.",
    modules: ["CARTA_QR"],
  },
  {
    id: "salon",
    label: "Salón",
    description: "Carta, pedidos desde la mesa, mozos, cocina y barra, y caja.",
    modules: ["CARTA_QR", "PEDIDOS", "KDS", "CAJA"],
  },
  {
    id: "muro",
    label: "Chamullame",
    description: "Solo Chamullame: pantalla gigante, chat de mesa y chamullos entre mesas. Para boliches, eventos y casamientos, aunque usen otro sistema.",
    modules: ["MURO"],
  },
  {
    id: "completo",
    label: "Pro",
    description: "Todo lo del Salón, más reservas, métricas, compras y Chamullame.",
    modules: ["CARTA_QR", "PEDIDOS", "KDS", "CAJA", "RESERVAS", "BI", "COMPRAS", "MURO"],
  },
];

/** Plan que coincide exactamente con estos módulos (o null si es una combinación a medida). */
export function planOf(modules: Iterable<ModuleKey>) {
  const set = new Set(modules);
  return PLANS.find((p) => p.modules.length === set.size && p.modules.every((m) => set.has(m))) ?? null;
}

/** Plan con el que arranca quien se registra solo. */
export const FREE_PLAN_ID = "carta";
/** El plan "Pro" (todo incluido): lleva la coronita. */
export const PRO_PLAN_ID = "completo";
/** Planes que se muestran en precios y en "Tu plan", en orden. */
export const PUBLIC_PLAN_IDS = ["carta", "salon", "completo"] as const;

export const planById = (id: string | null | undefined) => PLANS.find((p) => p.id === id) ?? null;

/** Qué incluye cada plan, en palabras para el dueño del local (precios, "Tu plan"). */
export const PLAN_FEATURES: Record<string, string[]> = {
  carta: ["Carta digital con fotos y QR por mesa", "Página de enlaces: Instagram, WhatsApp, reseñas", "Precios, gustos y stock al día"],
  salon: ["Todo lo del plan Gratis", "Pedidos desde la mesa", "Mozos, cocina y barra conectados", "Caja, cuenta dividida y cierre del día"],
  completo: ["Todo lo del Salón", "Reservas online", "Métricas del local", "Compras y costos", "Chamullame: chat entre mesas y pantalla gigante"],
};

/** Cuánto dura un código PRO antes de usarse. */
export const PRO_CODE_VALIDITY = [
  { minutes: 15, label: "15 minutos" },
  { minutes: 60, label: "1 hora" },
  { minutes: 24 * 60, label: "24 horas" },
  { minutes: 7 * 24 * 60, label: "7 días" },
] as const;
