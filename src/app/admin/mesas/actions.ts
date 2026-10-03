"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TableShape } from "@/generated/prisma/enums";
import { checkbox, fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import type { TenantDb } from "@/lib/tenant-db";

const newQrToken = () => randomBytes(12).toString("base64url");

async function auth() {
  return requireTenantRole(ADMIN_ROLES);
}

function refresh() {
  revalidatePath("/admin/mesas", "layout");
  revalidatePath("/staff", "layout");
}

type Rect = { posX: number; posY: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) =>
  a.posX < b.posX + b.width && b.posX < a.posX + a.width && a.posY < b.posY + b.height && b.posY < a.posY + a.height;

/** Primer hueco libre del plano para una mesa de w×h (de izquierda a derecha, de arriba abajo). */
function findFreeSpot(area: { width: number; height: number }, tables: Rect[], w: number, h: number) {
  for (let y = 0; y + h <= area.height; y++) {
    for (let x = 0; x + w <= area.width; x++) {
      const r = { posX: x, posY: y, width: w, height: h };
      if (!tables.some((t) => overlaps(t, r))) return { posX: x, posY: y };
    }
  }
  return null;
}

async function hasOpenSession(tdb: TenantDb, tableIds: string[]) {
  return (await tdb.tableSession.count({ where: { tableId: { in: tableIds }, status: { not: "CLOSED" } } })) > 0;
}

// ─────────────────────────────────────────────────────────────
// Salones
// ─────────────────────────────────────────────────────────────

const areaSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(30),
  width: z.coerce.number().int().min(6, "Mínimo 6").max(40, "Máximo 40"),
  height: z.coerce.number().int().min(4, "Mínimo 4").max(30, "Máximo 30"),
});

export async function createArea(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const parsed = areaSchema.safeParse({ width: 20, height: 12, ...Object.fromEntries(formData) });
  if (!parsed.success) return fail(parsed.error);
  const last = await tdb.area.findFirst({ orderBy: { sortOrder: "desc" } });
  await tdb.area.create({ data: { ...parsed.data, tenantId: tenant.id, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  refresh();
  return success(`Salón "${parsed.data.name}" creado`);
}

export async function updateArea(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb } = await auth();
  const parsed = areaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const tables = await tdb.table.findMany({ where: { areaId: id, archivedAt: null } });
  const outside = tables.filter((t) => t.posX + t.width > parsed.data.width || t.posY + t.height > parsed.data.height);
  if (outside.length) {
    return { error: `Las mesas ${outside.map((t) => t.number).join(", ")} quedarían fuera del plano. Movelas antes de achicarlo.` };
  }
  await tdb.area.update({ where: { id }, data: parsed.data });
  refresh();
  return success("Salón actualizado");
}

export async function deleteArea(id: string): Promise<ActionState> {
  const { tdb } = await auth();
  const tables = await tdb.table.findMany({ where: { areaId: id }, select: { id: true } });
  if (await hasOpenSession(tdb, tables.map((t) => t.id))) {
    return { error: "Hay mesas ocupadas en este salón" };
  }
  await tdb.area.delete({ where: { id } });
  refresh();
  return success("Salón borrado");
}

// ─────────────────────────────────────────────────────────────
// Mesas
// ─────────────────────────────────────────────────────────────

export async function createTable(areaId: string): Promise<ActionState & { id?: string }> {
  const { tdb, tenant } = await auth();
  const area = await tdb.area.findUniqueOrThrow({ where: { id: areaId }, include: { tables: { where: { archivedAt: null } } } });
  const spot = findFreeSpot(area, area.tables, 2, 2);
  if (!spot) return { error: "No queda lugar libre en el plano. Agrandalo desde la configuración del salón." };

  // Siguiente número libre (numérico) en todo el local.
  const numbers = new Set((await tdb.table.findMany({ select: { number: true } })).map((t) => t.number));
  let n = 1;
  while (numbers.has(String(n))) n++;

  const table = await tdb.table.create({
    data: { tenantId: tenant.id, areaId, number: String(n), seats: 4, maxGuests: 4, ...spot, qrToken: newQrToken() },
  });
  refresh();
  return { ...success(`Mesa ${n} creada`), id: table.id };
}

const tableSchema = z
  .object({
    number: z
      .string()
      .trim()
      .min(1, "Requerido")
      .max(6, "Máximo 6 caracteres")
      .regex(/^[\p{L}\d-]+$/u, "Solo letras, números y guiones"),
    seats: z.coerce.number().int().min(1, "Mínimo 1").max(30),
    maxGuests: z.coerce.number().int().min(1, "Mínimo 1").max(40),
    shape: z.enum(TableShape),
    width: z.coerce.number().int().min(1).max(8),
    height: z.coerce.number().int().min(1).max(8),
    disabled: checkbox,
  })
  .refine((t) => t.maxGuests >= t.seats, { message: "No puede ser menor que las sillas", path: ["maxGuests"] });

export async function updateTable(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb } = await auth();
  const parsed = tableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { disabled, ...data } = parsed.data;

  const table = await tdb.table.findUniqueOrThrow({ where: { id }, include: { area: { include: { tables: { where: { archivedAt: null } } } } } });
  const dup = await tdb.table.findFirst({ where: { number: data.number, id: { not: id } } });
  if (dup) return { error: `Ya existe una mesa ${data.number}`, fieldErrors: { number: "Número en uso" } };

  const rect = { posX: table.posX, posY: table.posY, width: data.width, height: data.height };
  if (rect.posX + rect.width > table.area.width || rect.posY + rect.height > table.area.height) {
    return { error: "Con ese tamaño se sale del plano" };
  }
  if (table.area.tables.some((t) => t.id !== id && overlaps(t, rect))) {
    return { error: "Con ese tamaño se superpone con otra mesa" };
  }

  if (disabled && table.status !== "DISABLED" && (await hasOpenSession(tdb, [id]))) {
    return { error: "La mesa está ocupada: cerrala antes de deshabilitarla" };
  }
  const status = disabled ? "DISABLED" : table.status === "DISABLED" ? "FREE" : table.status;

  await tdb.table.update({ where: { id }, data: { ...data, status } });
  refresh();
  return success("Mesa guardada");
}

/** Guarda la posición tras arrastrar. Valida límites y superposición en el servidor. */
export async function moveTable(id: string, posX: number, posY: number): Promise<ActionState> {
  const { tdb } = await auth();
  const table = await tdb.table.findUniqueOrThrow({ where: { id }, include: { area: { include: { tables: { where: { archivedAt: null } } } } } });
  const rect = { posX: Math.round(posX), posY: Math.round(posY), width: table.width, height: table.height };
  if (rect.posX < 0 || rect.posY < 0 || rect.posX + rect.width > table.area.width || rect.posY + rect.height > table.area.height) {
    return { error: "Fuera del plano" };
  }
  if (table.area.tables.some((t) => t.id !== id && overlaps(t, rect))) return { error: "Se superpone con otra mesa" };
  await tdb.table.update({ where: { id }, data: { posX: rect.posX, posY: rect.posY } });
  refresh();
  return success("Posición guardada");
}

export async function deleteTable(id: string): Promise<ActionState> {
  const { tdb } = await auth();
  if (await hasOpenSession(tdb, [id])) return { error: "La mesa está ocupada" };
  await tdb.table.delete({ where: { id } });
  refresh();
  return success("Mesa borrada");
}

/** Invalida el QR impreso (por ejemplo, si lo fotografiaron para pedir desde fuera). */
export async function regenerateQr(id: string): Promise<ActionState> {
  const { tdb } = await auth();
  await tdb.table.update({ where: { id }, data: { qrToken: newQrToken() } });
  refresh();
  return success("QR regenerado: imprimí el nuevo");
}
