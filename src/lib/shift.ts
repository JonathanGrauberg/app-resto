import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Resumen de un turno de caja: cobros por forma de pago, propinas, invitaciones y descuentos
 * de las mesas cobradas en el turno, y el efectivo que debería haber en el cajón.
 *   efectivo esperado = efectivo inicial + cobros en efectivo + propinas en efectivo
 * (el cambio devuelto ya está descontado: se registra lo aplicado a la cuenta, no lo entregado).
 */
export async function shiftSummary(tdb: TenantDb, shiftId: string) {
  const shift = await tdb.cashShift.findUniqueOrThrow({
    where: { id: shiftId },
    include: { payments: { include: { session: { select: { id: true, discountCents: true } } } } },
  });

  const methods = ["CASH", "CARD", "BIZUM", "OTHER"] as const;
  const byMethod = methods.map((m) => {
    const ps = shift.payments.filter((p) => p.method === m);
    return {
      method: m,
      count: ps.length,
      amountCents: ps.reduce((n, p) => n + p.amountCents, 0),
      tipCents: ps.reduce((n, p) => n + p.tipCents, 0),
    };
  });

  const sessionIds = [...new Set(shift.payments.map((p) => p.sessionId))];
  const comps = sessionIds.length
    ? await tdb.orderItem.findMany({
        where: { comped: true, order: { sessionId: { in: sessionIds }, status: { not: "REJECTED" } } },
        select: { unitPriceCents: true, quantity: true },
      })
    : [];
  const discountsCents = [...new Map(shift.payments.map((p) => [p.session.id, p.session.discountCents])).values()].reduce(
    (n, d) => n + d,
    0,
  );

  const cash = byMethod.find((m) => m.method === "CASH")!;
  const expectedCashCents = shift.openingCashCents + cash.amountCents + cash.tipCents;
  const salesCents = byMethod.reduce((n, m) => n + m.amountCents, 0);
  const tipsCents = byMethod.reduce((n, m) => n + m.tipCents, 0);

  return {
    id: shift.id,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openingCashCents: shift.openingCashCents,
    countedCashCents: shift.countedCashCents,
    notes: shift.notes,
    tables: sessionIds.length,
    byMethod,
    salesCents,
    tipsCents,
    compsCents: comps.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0),
    discountsCents,
    expectedCashCents,
    differenceCents: shift.countedCashCents == null ? null : shift.countedCashCents - expectedCashCents,
  };
}

export type ShiftSummary = Awaited<ReturnType<typeof shiftSummary>>;

export async function currentShift(tdb: TenantDb) {
  return tdb.cashShift.findFirst({ where: { closedAt: null }, orderBy: { openedAt: "desc" } });
}
