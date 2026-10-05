"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { currentShift } from "@/lib/shift";

const CASHIER = ["OWNER", "ADMIN", "CAJA"] as const;

const euros = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s|€/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) : null;
};

/** Abrir turno con el efectivo inicial del cajón. Solo puede haber uno abierto. */
export async function openShift(openingCash: string): Promise<ActionState> {
  const { tdb, tenant, membership } = await requireTenantRole([...CASHIER], "CAJA");
  if (await currentShift(tdb)) return { error: "Ya hay un turno abierto" };
  const cents = euros(openingCash);
  if (cents === null) return { error: "Importe no válido (ej. 100 o 150,50)" };
  await tdb.cashShift.create({ data: { tenantId: tenant.id, openedById: membership.id, openingCashCents: cents } });
  revalidatePath("/staff/caja");
  return { ok: "Turno abierto", at: Date.now() };
}

/** Cerrar turno con el efectivo contado (arqueo). */
export async function closeShift(shiftId: string, countedCash: string, notes: string): Promise<ActionState> {
  const { tdb, membership } = await requireTenantRole([...CASHIER], "CAJA");
  const shift = await tdb.cashShift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.closedAt) return { error: "El turno no está abierto" };
  const cents = euros(countedCash);
  if (cents === null) return { error: "Importe contado no válido" };
  await tdb.cashShift.update({
    where: { id: shiftId },
    data: { closedAt: new Date(), closedById: membership.id, countedCashCents: cents, notes: notes.trim().slice(0, 300) || null },
  });
  revalidatePath("/staff/caja");
  return { ok: "Turno cerrado", at: Date.now() };
}
