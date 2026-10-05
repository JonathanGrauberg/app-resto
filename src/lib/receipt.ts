import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * La cuenta de una mesa (documento informativo, NO es factura).
 * Se imprime desde caja y lleva un QR a /<slug>/cuenta/<token>, donde cada comensal ve
 * el detalle por persona y puede dividir. El enlace vale mientras la mesa está abierta
 * y RECEIPT_TTL_MS después de cobrarla.
 */
export const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

/** Crea (una sola vez) el enlace secreto y guarda el nombre de la mesa ("3+4"). */
export async function ensureReceipt(tdb: TenantDb, sessionId: string) {
  const session = await tdb.tableSession.findUniqueOrThrow({ where: { id: sessionId }, include: { table: true } });
  const members = session.table.groupId
    ? await tdb.table.findMany({ where: { groupId: session.table.groupId }, select: { number: true } })
    : [{ number: session.table.number }];
  const label = members
    .map((m) => m.number)
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .join("+");
  return tdb.tableSession.update({
    where: { id: sessionId },
    data: { receiptToken: session.receiptToken ?? randomBytes(16).toString("base64url"), tableLabel: label },
  });
}

const sessionInclude = {
  table: { select: { number: true } },
  waiter: { include: { user: { select: { name: true } } } },
  orders: {
    where: { status: { not: "REJECTED" as const } },
    orderBy: { round: "asc" as const },
    include: { items: { where: { status: { not: "CANCELLED" as const } }, orderBy: { id: "asc" as const } } },
  },
  payments: { orderBy: { createdAt: "asc" as const } },
};

type LoadedSession = NonNullable<Awaited<ReturnType<typeof loadForStaff>>>;

async function loadForStaff(tdb: TenantDb, sessionId: string) {
  return tdb.tableSession.findUnique({ where: { id: sessionId }, include: sessionInclude });
}

function build(s: LoadedSession, tenant: { name: string; slug: string }, settings: { address: string | null; phone: string | null } | null) {
  const rounds = s.orders.map((o) => ({
    round: o.round,
    at: o.createdAt.toISOString(),
    items: o.items.map((i) => {
      const mods = ((i.modifiers as { name: string }[]) ?? []).map((m) => m.name);
      return {
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitCents: i.unitPriceCents,
        // Invitación de la casa: no suma.
        totalCents: i.comped ? 0 : i.unitPriceCents * i.quantity,
        listCents: i.unitPriceCents * i.quantity,
        comped: i.comped,
        modifiers: mods,
        addedBy: i.addedBy,
        addedById: i.addedById,
      };
    }),
  }));
  const all = rounds.flatMap((r) => r.items);
  const consumedCents = all.reduce((n, i) => n + i.listCents, 0);
  const compsCents = all.filter((i) => i.comped).reduce((n, i) => n + i.listCents, 0);
  const discountCents = Math.min(s.discountCents, consumedCents - compsCents);
  const totalCents = Math.max(0, consumedCents - compsCents - discountCents);
  const payments = s.payments.map((p) => ({ method: p.method, amountCents: p.amountCents, tipCents: p.tipCents, receivedCents: p.receivedCents }));

  // Consumo por persona (apodo del comensal; lo cargado por el mozo queda como "Mesa").
  const byPerson = new Map<string, { label: string; totalCents: number; items: typeof all }>();
  for (const i of all) {
    const key = i.addedById ?? i.addedBy ?? "_mesa";
    const p = byPerson.get(key) ?? { label: i.addedBy ?? "Mesa", totalCents: 0, items: [] };
    p.totalCents += i.totalCents;
    p.items.push(i);
    byPerson.set(key, p);
  }

  // Lista única para el ticket: mismo plato + mismas opciones + mismo precio → una línea sumada.
  const merged = new Map<string, { key: string; name: string; modifiers: string[]; unitCents: number; quantity: number; totalCents: number; comped: boolean; people: string[] }>();
  for (const i of all) {
    const key = `${i.name}|${i.modifiers.join(",")}|${i.unitCents}|${i.comped ? "inv" : ""}`;
    const line = merged.get(key) ?? { key, name: i.name, modifiers: i.modifiers, unitCents: i.unitCents, quantity: 0, totalCents: 0, comped: i.comped, people: [] };
    line.quantity += i.quantity;
    line.totalCents += i.totalCents;
    const who = i.addedBy ?? "Mesa";
    if (!line.people.includes(who)) line.people.push(who);
    merged.set(key, line);
  }

  const closedAt = s.closedAt ?? null;
  return {
    venue: { name: tenant.name, slug: tenant.slug, address: settings?.address ?? null, phone: settings?.phone ?? null },
    tableLabel: s.tableLabel ?? s.table.number,
    status: s.status,
    guests: s.guests,
    waiterName: s.waiter?.user.name ?? null,
    openedAt: s.openedAt.toISOString(),
    closedAt: closedAt?.toISOString() ?? null,
    expiresAt: closedAt ? new Date(closedAt.getTime() + RECEIPT_TTL_MS).toISOString() : null,
    receiptToken: s.receiptToken,
    rounds,
    lines: [...merged.values()],
    consumedCents,
    compsCents,
    discountCents,
    discountReason: s.discountReason,
    payments,
    tipsCents: payments.reduce((n, p) => n + p.tipCents, 0),
    people: [...byPerson.values()].sort((a, b) => b.totalCents - a.totalCents),
    totalCents,
  };
}

export type Receipt = ReturnType<typeof build>;

/** Para el personal (sin vencimiento). */
export async function receiptForStaff(tdb: TenantDb, tenant: { id: string; name: string; slug: string }, sessionId: string) {
  const s = await loadForStaff(tdb, sessionId);
  if (!s) return null;
  const settings = await db.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { address: true, phone: true } });
  return build(s, tenant, settings);
}

/** Para el comensal por el QR: solo si el enlace sigue vigente. */
export async function receiptByToken(slug: string, token: string) {
  const s = await db.tableSession.findUnique({
    where: { receiptToken: token },
    include: { ...sessionInclude, tenant: { include: { settings: true } } },
  });
  if (!s || s.tenant.slug !== slug || !s.tenant.active) return { state: "missing" as const };
  if (s.closedAt && Date.now() > s.closedAt.getTime() + RECEIPT_TTL_MS) return { state: "expired" as const, venue: s.tenant.name };
  return { state: "ok" as const, receipt: build(s, s.tenant, s.tenant.settings) };
}

/** Si este celular estuvo en una mesa que ya pagó, la ruta a su cuenta (mientras siga vigente). */
export async function paidReceiptPath(tenant: { id: string; slug: string }, dinerSessionId: string) {
  const paid = await db.tableSession.findFirst({
    where: { id: dinerSessionId, tenantId: tenant.id, status: "CLOSED", receiptToken: { not: null } },
    select: { receiptToken: true, closedAt: true },
  });
  if (!paid?.closedAt || Date.now() > paid.closedAt.getTime() + RECEIPT_TTL_MS) return null;
  return `/${tenant.slug}/cuenta/${paid.receiptToken}`;
}
