/**
 * Estado de un plato tal como lo entiende la gente (comensal, mozo, cuenta),
 * combinando el estado del pedido (¿lo aceptó el mozo?) y el del plato (cocina).
 */
export type ItemPhase = "waiting" | "preparing" | "ready" | "delivered" | "rejected" | "cancelled";

export function itemPhase(orderStatus: string, itemStatus: string): ItemPhase {
  if (orderStatus === "REJECTED") return "rejected";
  if (itemStatus === "CANCELLED") return "cancelled";
  if (orderStatus === "PENDING") return "waiting";
  if (itemStatus === "READY") return "ready";
  if (itemStatus === "DELIVERED" || orderStatus === "COMPLETED") return "delivered";
  return "preparing";
}

export const PHASE_LABEL: Record<ItemPhase, { label: string; className: string }> = {
  waiting: { label: "Esperando al mozo", className: "bg-warn-soft text-warn" },
  preparing: { label: "En preparación", className: "bg-brand-soft text-brand" },
  ready: { label: "¡Listo!", className: "bg-ok text-white" },
  delivered: { label: "Entregado", className: "bg-ok-soft text-ok" },
  rejected: { label: "No se pudo tomar", className: "bg-danger-soft text-danger" },
  cancelled: { label: "No sale", className: "bg-danger-soft text-danger" },
};
