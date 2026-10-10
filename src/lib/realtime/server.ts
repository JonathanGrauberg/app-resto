import "server-only";
import * as Ably from "ably";

/**
 * Tiempo real (Ably). Diseño:
 * - El servidor PUBLICA avisos chicos ("hay novedades en la mesa X"); las pantallas,
 *   al recibirlos, vuelven a pedir los datos al servidor. Por Ably no viajan datos personales.
 * - Cada pantalla recibe un token temporal que SOLO le permite escuchar sus canales.
 * - Si no hay ABLY_API_KEY, todo sigue funcionando con actualización periódica.
 *
 * Canales:
 *   t:<tenantId>:staff             → todo el personal del local (sala, caja, cocina, bar)
 *   t:<tenantId>:mesa:<sessionId>  → los comensales de una mesa
 */

export type StaffEvent =
  | { type: "table"; tableId?: string } // cambió el estado de una mesa (abrir, juntar, cerrar…)
  | { type: "order.created"; tableLabel: string; sessionId: string; orderId: string; noWaiter: boolean; waiterId: string | null }
  | { type: "order.updated"; sessionId: string; orderId: string }
  | { type: "waiter.called"; tableLabel: string; sessionId: string; waiterId: string | null }
  // Pedido aceptado: suena en las pantallas de las estaciones que tienen platos para preparar.
  | { type: "kitchen.new"; tableLabel: string; stations: ("KITCHEN" | "BAR")[] }
  // Cocina/bar terminó: el mozo de la mesa tiene que llevarlo.
  | { type: "item.ready"; tableLabel: string; sessionId: string; waiterId: string | null; station: string; summary: string }
  // Cocina/barra no puede hacer un plato: aviso al mozo de la mesa.
  | { type: "item.cancelled"; tableLabel: string; sessionId: string; waiterId: string | null; summary: string; reason: string }
  // Cocina/barra llama al mozo (de una mesa o a cualquiera).
  | {
      type: "kitchen.call";
      tableLabel: string | null;
      sessionId: string | null;
      waiterId: string | null;
      message: string;
      from: "KITCHEN" | "BAR";
    }
  // La mesa pasó a pendiente de cobro: aviso a caja.
  | { type: "table.pending"; tableLabel: string; sessionId: string; waiterName: string; byId: string }
  // Reservas online: aviso a caja / admin.
  | { type: "booking.new"; name: string; party: number; startsAt: string; tables: string }
  | { type: "booking.cancelled"; name: string; startsAt: string };

export type TableEvent =
  | { type: "cart" } // alguien de la mesa cambió el carrito
  | { type: "order"; orderId: string } // pedido nuevo o cambió su estado
  | { type: "session" }; // la mesa cambió de estado (cerrada, por cobrar, mozo asignado…)

export const staffChannel = (tenantId: string) => `t:${tenantId}:staff`;
export const tableChannel = (tenantId: string, sessionId: string) => `t:${tenantId}:mesa:${sessionId}`;

let rest: Ably.Rest | null = null;
export function realtimeEnabled() {
  return !!process.env.ABLY_API_KEY;
}
function client() {
  if (!realtimeEnabled()) return null;
  rest ??= new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  return rest;
}

/** Publica sin bloquear ni romper la acción si Ably falla (la pantalla igual se refresca sola). */
async function publish(channel: string, data: object) {
  const c = client();
  if (!c) return;
  try {
    await c.channels.get(channel).publish("evt", data);
  } catch (err) {
    console.warn("[realtime] no se pudo publicar en", channel, err);
  }
}

export const notifyStaff = (tenantId: string, evt: StaffEvent) => publish(staffChannel(tenantId), evt);
export const notifyTable = (tenantId: string, sessionId: string, evt: TableEvent) =>
  publish(tableChannel(tenantId, sessionId), evt);

/** Token temporal que solo permite ESCUCHAR los canales indicados. */
export async function createSubscribeToken(clientId: string, channels: string[]) {
  const c = client();
  if (!c) return null;
  return c.auth.createTokenRequest({
    clientId,
    ttl: 60 * 60 * 1000, // 1 h; el SDK lo renueva solo pidiendo otro a nuestro endpoint
    capability: Object.fromEntries(channels.map((ch) => [ch, ["subscribe"]])),
  });
}
