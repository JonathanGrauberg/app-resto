import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * La cuenta de una mesa, calculada siempre en el servidor y en céntimos:
 *   consumo − invitaciones − descuento = total a pagar
 * Lo usan la caja (cobrar), el ticket y las métricas.
 */

export const METHOD_LABEL = { CASH: "Efectivo", CARD: "Tarjeta", BIZUM: "Bizum", OTHER: "Otro" } as const;

export async function computeBill(tdb: TenantDb, sessionId: string) {
  const session = await tdb.tableSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      orders: {
        where: { status: { not: "REJECTED" } },
        include: { items: { where: { status: { not: "CANCELLED" } }, orderBy: { id: "asc" } } },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  const items = session.orders.flatMap((o) =>
    o.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unitCents: i.unitPriceCents,
      lineCents: i.unitPriceCents * i.quantity,
      modifiers: ((i.modifiers as { name: string }[]) ?? []).map((m) => m.name),
      addedBy: i.addedBy,
      comped: i.comped,
      compReason: i.compReason,
    })),
  );
  const consumedCents = items.reduce((n, i) => n + i.lineCents, 0);
  const compsCents = items.filter((i) => i.comped).reduce((n, i) => n + i.lineCents, 0);
  const discountCents = Math.min(session.discountCents, consumedCents - compsCents);
  const totalCents = Math.max(0, consumedCents - compsCents - discountCents);
  const paidCents = session.payments.reduce((n, p) => n + p.amountCents, 0);
  const tipsCents = session.payments.reduce((n, p) => n + p.tipCents, 0);

  return {
    sessionId,
    status: session.status,
    guests: session.guests,
    items,
    consumedCents,
    compsCents,
    discountCents,
    discountReason: session.discountReason,
    totalCents,
    paidCents,
    tipsCents,
    remainingCents: Math.max(0, totalCents - paidCents),
    payments: session.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amountCents,
      tipCents: p.tipCents,
      receivedCents: p.receivedCents,
    })),
  };
}

export type Bill = Awaited<ReturnType<typeof computeBill>>;
