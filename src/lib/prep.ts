import "server-only";
import type { PrepMode, PrepStation, Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/**
 * Reparto de lo que hay que preparar según el local:
 * - SEPARATE: cocina recibe lo de cocina; barra, lo de bar.
 * - SINGLE: una sola pantalla (Cocina) recibe todo. Los productos conservan su estación
 *   ("Cocina"/"Bar"), así que volver a separar no obliga a reeditar la carta.
 */

export async function getPrepMode(tenantId: string): Promise<PrepMode> {
  const s = await db.tenantSettings.findUnique({ where: { tenantId }, select: { prepMode: true } });
  return s?.prepMode ?? "SEPARATE";
}

/** Estaciones que muestra una pantalla. */
export function screenStations(mode: PrepMode, screen: "KITCHEN" | "BAR"): PrepStation[] {
  if (mode === "SINGLE") return ["KITCHEN", "BAR"];
  return [screen];
}

/** Pantallas que tienen que sonar para estas estaciones. */
export function routeStations(mode: PrepMode, stations: PrepStation[]): ("KITCHEN" | "BAR")[] {
  const real = [...new Set(stations)].filter((s): s is "KITCHEN" | "BAR" => s !== "NONE");
  if (mode === "SINGLE") return real.length ? ["KITCHEN"] : [];
  return real;
}

/** Qué estaciones puede marcar cada rol (null = todas). En modo único, cocina y barra comparten pantalla. */
export function editableStations(mode: PrepMode, role: Role): PrepStation[] | null {
  if (role === "COCINA") return mode === "SINGLE" ? ["KITCHEN", "BAR"] : ["KITCHEN"];
  if (role === "BAR") return mode === "SINGLE" ? ["KITCHEN", "BAR"] : ["BAR"];
  return null;
}
