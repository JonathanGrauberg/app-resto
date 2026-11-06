import "server-only";
import { createHash, randomInt } from "node:crypto";
import { cache } from "react";
import { db } from "@/lib/db";
import { planById, PRO_PLAN_ID, type PLANS } from "@/lib/plans";
import { regionOf } from "@/lib/region";
import { addMonths, billingState, nextPeriodStart } from "@/lib/subscription";

/**
 * Códigos PRO: el equipo de Yatay cierra la venta (WhatsApp, visita) y genera un código de un solo uso
 * que vence rápido. El local lo ingresa (al iniciar sesión, al registrarse o en "Tu plan") y se le activa el plan.
 */

/** Sin letras ni números que se confunden (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "pro-7k3x 9qf2" → "7K3X9QF2" (acepta con o sin guiones, espacios o el prefijo PRO). */
export function normalizeCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^PRO/, "");
}

const hashCode = (raw: string) => createHash("sha256").update(normalizeCode(raw)).digest("hex");

function newCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `PRO-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Crea un código y lo devuelve en claro (es la única vez que se ve; en la base queda el hash). */
export async function createProCode(opts: {
  planId: string;
  months: number | null;
  vip: boolean;
  tenantId: string | null;
  validMinutes: number;
  note: string | null;
  createdBy: string;
}) {
  const code = newCode();
  await db.proCode.create({
    data: {
      codeHash: hashCode(code),
      planId: opts.planId,
      months: opts.months,
      vip: opts.vip,
      tenantId: opts.tenantId,
      note: opts.note,
      createdBy: opts.createdBy,
      expiresAt: new Date(Date.now() + opts.validMinutes * 60_000),
    },
  });
  return code;
}

/** Deja prendidos los módulos del plan (sin vencimiento). No apaga lo que el local ya tenga de más. */
export async function enablePlanModules(tenantId: string, plan: (typeof PLANS)[number]) {
  await db.$transaction(
    plan.modules.map((module) =>
      db.tenantModule.upsert({
        where: { tenantId_module: { tenantId, module } },
        update: { enabled: true, expiresAt: null },
        create: { tenantId, module, enabled: true },
      }),
    ),
  );
}

export type RedeemResult = { ok: true; message: string } | { ok: false; error: string };

/** El local ingresa un código: si sirve, se marca usado (una sola vez) y se le activa el plan. */
export async function redeemProCode(tenantId: string, raw: string): Promise<RedeemResult> {
  if (normalizeCode(raw).length !== 8) return { ok: false, error: "El código tiene este formato: PRO-XXXX-XXXX" };
  const pc = await db.proCode.findUnique({ where: { codeHash: hashCode(raw) } });
  const invalid = { ok: false as const, error: "Ese código no es válido, ya se usó o venció. Pedinos uno nuevo." };
  if (!pc || pc.usedAt || pc.expiresAt < new Date() || (pc.tenantId && pc.tenantId !== tenantId)) return invalid;
  const plan = planById(pc.planId);
  if (!plan) return invalid;

  // Se marca usado solo si nadie lo usó a la par.
  const { count } = await db.proCode.updateMany({
    where: { id: pc.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date(), usedTenantId: tenantId },
  });
  if (count !== 1) return invalid;

  const [sub, settings] = await Promise.all([
    db.subscription.findUnique({ where: { tenantId } }),
    db.tenantSettings.findUnique({ where: { tenantId }, select: { country: true, currency: true } }),
  ]);
  const until = pc.months ? addMonths(nextPeriodStart(sub), pc.months) : null;
  const data = {
    planId: plan.id,
    cancelledAt: null,
    ...(pc.vip ? { vip: true } : {}),
    ...(until ? { paidUntil: until } : {}),
  };
  await db.subscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, currency: regionOf(settings).currency, ...data },
  });
  await enablePlanModules(tenantId, plan);

  const fmt = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const what = plan.id === PRO_PLAN_ID ? "¡Ya sos PRO!" : `¡Listo! Ya tenés el plan ${plan.label}.`;
  const when = pc.vip ? " Es VIP: sin vencimiento." : until ? ` Activo hasta el ${fmt(until)}.` : "";
  return { ok: true, message: what + when };
}

/** Plan actual del local y si lleva la coronita (Pro vigente: al día, en prueba, VIP o sin cargo). */
export const tenantPlan = cache(async (tenantId: string) => {
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  const state = billingState(sub);
  const plan = planById(sub?.planId);
  const live = state.kind !== "cancelled" && state.kind !== "overdue";
  return { plan, state, vip: !!sub?.vip, pro: live && plan?.id === PRO_PLAN_ID };
});

/** Últimos códigos generados, con su estado (para la plataforma). */
export async function recentProCodes() {
  const codes = await db.proCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const ids = [...new Set(codes.flatMap((c) => [c.tenantId, c.usedTenantId]).filter((x): x is string => !!x))];
  const tenants = new Map((await db.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const now = Date.now();
  return codes.map((c) => ({
    ...c,
    plan: planById(c.planId)?.label ?? c.planId,
    forTenant: c.tenantId ? (tenants.get(c.tenantId) ?? "Local borrado") : null,
    usedBy: c.usedTenantId ? (tenants.get(c.usedTenantId) ?? "Local borrado") : null,
    status: c.usedAt ? ("used" as const) : c.expiresAt.getTime() <= now ? ("expired" as const) : ("valid" as const),
  }));
}
