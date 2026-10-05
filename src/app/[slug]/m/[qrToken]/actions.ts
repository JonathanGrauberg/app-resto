"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { defaultNickname, newDinerId, setDinerCookie } from "@/lib/diner";
import { notifyStaff, notifyTable } from "@/lib/realtime/server";
import { currentDiner, tableContext, type TableContext } from "@/lib/table-session";

/**
 * Acciones del comensal (sin cuenta). Todo se valida contra el QR de la mesa y la cookie
 * firmada del comensal; los precios y opciones se toman siempre de la base, nunca del cliente.
 */

type Result = ActionState & { orderId?: string; round?: number };

const err = (error: string): Result => ({ error });

async function ctxOrError(
  slug: string,
  qrToken: string,
): Promise<{ ok: true; ctx: TableContext } | { ok: false; error: string }> {
  const ctx = await tableContext(slug, qrToken);
  if (!ctx) return { ok: false, error: "Esta mesa no existe o el QR ya no es válido" };
  if (ctx.table.status === "DISABLED") return { ok: false, error: "Esta mesa no está disponible" };
  return { ok: true, ctx };
}

function refreshTable(ctx: TableContext) {
  revalidatePath(`/${ctx.tenant.slug}/m/${ctx.table.qrToken}`);
}

// ─────────────────────────────────────────────────────────────
// Unirse a la mesa
// ─────────────────────────────────────────────────────────────

export async function joinTable(slug: string, qrToken: string, nickname: string): Promise<Result> {
  const r = await ctxOrError(slug, qrToken);
  if (!r.ok) return err(r.error);
  const { ctx } = r;

  if (ctx.session?.status === "PENDING_PAYMENT") {
    return err("Esta mesa está cerrando la cuenta. Si recién te sentás, avisale al personal.");
  }
  if (await currentDiner(ctx)) return { ok: "Ya estás en la mesa" };

  let session = ctx.session;
  if (!session) {
    // Primer comensal: se abre la mesa (sin mozo; el personal recibe el aviso).
    session = await ctx.tdb.tableSession.create({
      data: { tenantId: ctx.tenant.id, tableId: ctx.table.id, guests: 1 },
    });
    await ctx.tdb.table.updateMany({ where: { id: { in: ctx.members.map((m) => m.id) } }, data: { status: "OCCUPIED" } });
  }

  // Cuántos comensales distintos ya participaron (para el apodo por defecto y el conteo).
  const [cartBy, orderBy] = await Promise.all([
    ctx.tdb.cartItem.findMany({ where: { sessionId: session.id }, select: { addedById: true }, distinct: ["addedById"] }),
    ctx.tdb.orderItem.findMany({ where: { order: { sessionId: session.id } }, select: { addedById: true }, distinct: ["addedById"] }),
  ]);
  const known = new Set([...cartBy, ...orderBy].map((x) => x.addedById).filter(Boolean)).size;

  const name = nickname.trim().slice(0, 20) || defaultNickname(known);
  await setDinerCookie({ sessionId: session.id, dinerId: newDinerId(), nickname: name, tenantId: ctx.tenant.id });

  // Si se unen más personas que las cargadas, se actualiza el número de comensales.
  if (known + 1 > session.guests) {
    await ctx.tdb.tableSession.update({ where: { id: session.id }, data: { guests: known + 1 } });
  }

  await notifyStaff(ctx.tenant.id, { type: "table", tableId: ctx.table.id });
  await notifyTable(ctx.tenant.id, session.id, { type: "session" });
  refreshTable(ctx);
  return { ok: `¡Listo, ${name}!` };
}

// ─────────────────────────────────────────────────────────────
// Carrito compartido
// ─────────────────────────────────────────────────────────────

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  optionIds: z.array(z.string()).max(30),
  notes: z.string().trim().max(140).optional(),
});

export async function addToCart(slug: string, qrToken: string, input: z.input<typeof addSchema>): Promise<Result> {
  const r = await ctxOrError(slug, qrToken);
  if (!r.ok) return err(r.error);
  const { ctx } = r;
  const diner = await currentDiner(ctx);
  if (!diner || !ctx.session) return err("Primero unite a la mesa");
  if (ctx.session.status !== "OPEN") return err("La mesa ya no acepta pedidos");

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return err("Datos no válidos");
  const { productId, quantity, optionIds, notes } = parsed.data;

  const product = await ctx.tdb.product.findUnique({
    where: { id: productId },
    include: { modifierGroups: { include: { group: { include: { options: true } } } } },
  });
  if (!product || !product.visible) return err("Ese plato ya no está en la carta");
  if (!product.available) return err(`${product.name} está agotado`);

  // Validar opciones: deben ser de los grupos del plato y respetar mínimos/máximos.
  const modifiers: { groupId: string; groupName: string; optionId: string; name: string; extraPriceCents: number }[] = [];
  for (const { group } of product.modifierGroups) {
    const chosen = group.options.filter((o) => optionIds.includes(o.id));
    if (chosen.length < group.minSelect) return err(`Elegí ${group.name.toLowerCase()}`);
    if (chosen.length > group.maxSelect) return err(`En ${group.name.toLowerCase()} podés elegir hasta ${group.maxSelect}`);
    for (const o of chosen) {
      modifiers.push({ groupId: group.id, groupName: group.name, optionId: o.id, name: o.name, extraPriceCents: o.extraPriceCents });
    }
  }
  if (modifiers.length !== new Set(optionIds).size) return err("Opción no válida");

  await ctx.tdb.cartItem.create({
    data: {
      tenantId: ctx.tenant.id,
      sessionId: ctx.session.id,
      productId,
      quantity,
      modifiers,
      notes: notes || null,
      addedBy: diner.nickname,
      addedById: diner.dinerId,
    },
  });
  await notifyTable(ctx.tenant.id, ctx.session.id, { type: "cart" });
  refreshTable(ctx);
  return { ok: `${product.name} agregado al pedido` };
}

export async function updateCartItem(slug: string, qrToken: string, itemId: string, quantity: number): Promise<Result> {
  const r = await ctxOrError(slug, qrToken);
  if (!r.ok) return err(r.error);
  const { ctx } = r;
  if (!(await currentDiner(ctx)) || !ctx.session) return err("Primero unite a la mesa");

  const item = await ctx.tdb.cartItem.findFirst({ where: { id: itemId, sessionId: ctx.session.id } });
  if (!item) return { ok: "Ya no estaba en el pedido" };
  const q = Math.round(quantity);
  if (q <= 0) await ctx.tdb.cartItem.delete({ where: { id: item.id } });
  else await ctx.tdb.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(q, 20) } });

  await notifyTable(ctx.tenant.id, ctx.session.id, { type: "cart" });
  refreshTable(ctx);
  return { ok: "Pedido actualizado" };
}

// ─────────────────────────────────────────────────────────────
// Enviar pedido (una "ronda")
// ─────────────────────────────────────────────────────────────

export async function submitOrder(slug: string, qrToken: string): Promise<Result> {
  const r = await ctxOrError(slug, qrToken);
  if (!r.ok) return err(r.error);
  const { ctx } = r;
  const diner = await currentDiner(ctx);
  const session = ctx.session;
  if (!diner || !session) return err("Primero unite a la mesa");
  if (session.status !== "OPEN") return err("La mesa ya no acepta pedidos");

  const cart = await ctx.tdb.cartItem.findMany({
    where: { sessionId: session.id },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });
  if (cart.length === 0) return err("El pedido está vacío");
  const unavailable = cart.filter((c) => !c.product.available || !c.product.visible);
  if (unavailable.length) {
    return err(`Se agotó: ${[...new Set(unavailable.map((c) => c.product.name))].join(", ")}. Quitalo del pedido para enviar.`);
  }

  const order = await ctx.tdb.$transaction(async (tx) => {
    const last = await tx.order.findFirst({ where: { sessionId: session.id }, orderBy: { round: "desc" } });
    const created = await tx.order.create({
      data: {
        tenantId: ctx.tenant.id,
        sessionId: session.id,
        round: (last?.round ?? 0) + 1,
        source: "GUEST",
        items: {
          create: cart.map((c) => {
            const mods = (c.modifiers as { name: string; extraPriceCents: number }[]) ?? [];
            return {
              tenantId: ctx.tenant.id,
              productId: c.productId,
              // Copia de nombre y precio al momento del pedido (la carta puede cambiar después).
              name: c.product.name,
              unitPriceCents: c.product.priceCents + mods.reduce((n, m) => n + m.extraPriceCents, 0),
              quantity: c.quantity,
              modifiers: mods,
              notes: c.notes,
              station: c.product.station,
              addedBy: c.addedBy,
              addedById: c.addedById,
            };
          }),
        },
      },
    });
    await tx.cartItem.deleteMany({ where: { sessionId: session.id } });
    await tx.notification.create({
      data: {
        tenantId: ctx.tenant.id,
        type: session.waiterId ? "ORDER_PENDING" : "ORDER_NO_WAITER",
        targetMembershipId: session.waiterId,
        tableId: ctx.table.id,
        sessionId: session.id,
        orderId: created.id,
        message: `Pedido nuevo en mesa ${ctx.label}${session.waiterId ? "" : " (sin mozo)"}`,
      },
    });
    return created;
  });

  await notifyStaff(ctx.tenant.id, {
    type: "order.created",
    tableLabel: ctx.label,
    sessionId: session.id,
    orderId: order.id,
    noWaiter: !session.waiterId,
    waiterId: session.waiterId,
  });
  await notifyTable(ctx.tenant.id, session.id, { type: "order", orderId: order.id });
  refreshTable(ctx);
  return { ok: "¡Pedido enviado!", orderId: order.id, round: order.round };
}

// ─────────────────────────────────────────────────────────────
// Llamar al mozo
// ─────────────────────────────────────────────────────────────

export async function callWaiter(slug: string, qrToken: string): Promise<Result> {
  const r = await ctxOrError(slug, qrToken);
  if (!r.ok) return err(r.error);
  const { ctx } = r;
  if (!(await currentDiner(ctx)) || !ctx.session) return err("Primero unite a la mesa");

  // Evita repetir el aviso si tocan muchas veces seguidas.
  const recent = ctx.session.waiterCalledAt && Date.now() - ctx.session.waiterCalledAt.getTime() < 60_000;
  if (!recent) {
    await ctx.tdb.tableSession.update({ where: { id: ctx.session.id }, data: { waiterCalledAt: new Date() } });
    await ctx.tdb.notification.create({
      data: {
        tenantId: ctx.tenant.id,
        type: "WAITER_CALLED",
        targetMembershipId: ctx.session.waiterId,
        tableId: ctx.table.id,
        sessionId: ctx.session.id,
        message: `Mesa ${ctx.label} llama al mozo`,
      },
    });
    await notifyStaff(ctx.tenant.id, {
      type: "waiter.called",
      tableLabel: ctx.label,
      sessionId: ctx.session.id,
      waiterId: ctx.session.waiterId,
    });
    await notifyTable(ctx.tenant.id, ctx.session.id, { type: "session" });
  }
  refreshTable(ctx);
  return { ok: "Avisamos al mozo. Ya viene." };
}
