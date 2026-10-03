import "server-only";
import type { ModuleKey } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: "CARTA_QR", label: "Carta QR", description: "Carta digital pública y QR por mesa (base)" },
  { key: "PEDIDOS", label: "Pedidos", description: "Carrito compartido, pedidos y gestión de mozos" },
  { key: "KDS", label: "Cocina / Bar", description: "Pantallas de preparación y aviso de plato listo" },
  { key: "CAJA", label: "Caja", description: "Pre-cuenta, cierre y liberación de mesas" },
  { key: "RESERVAS", label: "Reservas", description: "Reservas públicas, eventos y control de horarios" },
  { key: "BI", label: "Métricas", description: "Rotación, estadía y facturación por mesa" },
  { key: "MULTI_IDIOMA", label: "Multi-idioma", description: "Traducciones propias de la carta" },
];

export async function getEnabledModules(tenantId: string): Promise<Set<ModuleKey>> {
  const rows = await db.tenantModule.findMany({ where: { tenantId, enabled: true } });
  const now = new Date();
  return new Set(rows.filter((r) => !r.expiresAt || r.expiresAt > now).map((r) => r.module));
}

export async function hasModule(tenantId: string, module: ModuleKey) {
  return (await getEnabledModules(tenantId)).has(module);
}
