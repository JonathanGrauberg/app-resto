"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { CAN_MANAGE_TABLES } from "@/lib/auth/permissions";
import { notifyStaff } from "@/lib/realtime/server";
import { tableLabelOf } from "@/lib/table-session";
import { openTable } from "./sala-actions";

/**
 * Lista de espera presencial: quien llega sin reserva se anota y se sienta por orden.
 * Mientras haya gente esperando, la web deja de ofrecer horarios cercanos (ver lib/booking).
 */

const ok = (message: string): ActionState => ({ ok: message, at: Date.now() });
const err = (message: string): ActionState => ({ error: message });

async function refresh(tenantId: string) {
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
  await notifyStaff(tenantId, { type: "table" });
}

const entrySchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(40),
  partySize: z.number().int().min(1, "Mínimo 1").max(50),
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(140)
    .transform((v) => v || null),
});

export async function addToWaitlist(input: z.input<typeof entrySchema>): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(CAN_MANAGE_TABLES);
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Datos no válidos");
  await tdb.waitlistEntry.create({ data: { ...parsed.data, tenantId: tenant.id } });
  await refresh(tenant.id);
  return ok(`${parsed.data.name} anotado en la lista`);
}

/** Se sienta: abre la mesa con sus comensales y sale de la lista. */
export async function seatFromWaitlist(entryId: string, tableId: string): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(CAN_MANAGE_TABLES);
  const entry = await tdb.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.status !== "WAITING") return err("Ese grupo ya no está en la lista");
  const table = await tdb.table.findUnique({ where: { id: tableId } });
  if (!table) return err("Mesa no encontrada");
  const opened = await openTable(tableId, entry.partySize);
  if (opened?.error) return opened;
  await tdb.waitlistEntry.update({
    where: { id: entryId },
    data: { status: "SEATED", seatedAt: new Date(), tableLabel: await tableLabelOf(tdb, table) },
  });
  await refresh(tenant.id);
  return ok(`${entry.name} sentado en la mesa ${table.number}`);
}

/** Se fue sin sentarse (o se anotó por error). */
export async function leaveWaitlist(entryId: string): Promise<ActionState> {
  const { tdb, tenant } = await requireTenantRole(CAN_MANAGE_TABLES);
  await tdb.waitlistEntry.updateMany({ where: { id: entryId, status: "WAITING" }, data: { status: "LEFT", leftAt: new Date() } });
  await refresh(tenant.id);
  return ok("Quitado de la lista");
}
