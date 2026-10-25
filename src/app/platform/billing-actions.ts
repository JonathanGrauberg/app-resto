"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, optionalText, priceInput, success, type ActionState } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { addMonths, nextPeriodStart, PAYMENT_METHODS } from "@/lib/subscription";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { regionOf } from "@/lib/region";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Fecha del formulario (día) → fin de ese día en UTC; vacío → null. */
const dayEnd = (v: string | null) => (v && isDate(v) ? new Date(`${v}T23:59:59Z`) : null);

async function regionFor(tenantId: string) {
  const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { country: true, currency: true, locale: true, timezone: true } });
  return regionOf(settings);
}

function refresh(tenantId: string) {
  revalidatePath("/platform", "layout");
  revalidatePath(`/platform/locales/${tenantId}`);
  revalidatePath("/admin", "layout");
}

/** Plan, precio mensual, fin de la prueba y notas de la suscripción de un local. */
export async function saveSubscription(tenantId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const region = await regionFor(tenantId);
  const parsed = z
    .object({
      planId: z.string().refine((v) => v === "" || PLANS.some((p) => p.id === v), "Plan no válido"),
      price: priceInput(region),
      trialEndsAt: z.string().refine((v) => v === "" || isDate(v), "Fecha no válida"),
      notes: optionalText,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const data = { planId: d.planId || null, priceCents: d.price, trialEndsAt: dayEnd(d.trialEndsAt), notes: d.notes };
  await db.subscription.upsert({ where: { tenantId }, update: data, create: { tenantId, currency: region.currency, ...data } });
  refresh(tenantId);
  return success("Suscripción guardada");
}

/** Registra un pago: extiende "pagado hasta" la cantidad de meses pagados. */
export async function registerPayment(tenantId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformAdmin();
  const region = await regionFor(tenantId);
  const parsed = z
    .object({
      amount: priceInput(region),
      months: z.coerce.number().int().min(1, "Mínimo 1 mes").max(24, "Máximo 24 meses"),
      method: z.enum(Object.keys(PAYMENT_METHODS) as [keyof typeof PAYMENT_METHODS]),
      paidAt: z.string().refine(isDate, "Fecha no válida"),
      reference: optionalText,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (!sub) return { error: "Primero guardá el plan y el precio de la suscripción" };

  const periodFrom = nextPeriodStart(sub);
  const periodTo = addMonths(periodFrom, d.months);
  await db.$transaction([
    db.billingPayment.create({
      data: {
        tenantId,
        amountCents: d.amount,
        currency: sub.currency,
        method: d.method,
        months: d.months,
        periodFrom,
        periodTo,
        paidAt: new Date(`${d.paidAt}T12:00:00Z`),
        reference: d.reference,
        recordedBy: user.name,
      },
    }),
    db.subscription.update({ where: { tenantId }, data: { paidUntil: periodTo, cancelledAt: null } }),
  ]);
  refresh(tenantId);
  return success(`Pago registrado: queda pago hasta el ${periodTo.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`);
}

/** Borra un pago cargado por error (solo el último) y vuelve "pagado hasta" a donde estaba. */
export async function deletePayment(tenantId: string, paymentId: string) {
  await requirePlatformAdmin();
  const last = await db.billingPayment.findFirst({ where: { tenantId }, orderBy: { periodTo: "desc" } });
  if (!last || last.id !== paymentId) throw new Error("Solo se puede borrar el último pago");
  const prev = await db.billingPayment.findFirst({ where: { tenantId, id: { not: paymentId } }, orderBy: { periodTo: "desc" } });
  await db.$transaction([
    db.billingPayment.delete({ where: { id: paymentId } }),
    db.subscription.update({ where: { tenantId }, data: { paidUntil: prev?.periodTo ?? null } }),
  ]);
  refresh(tenantId);
}

/** Dar de baja o reactivar la suscripción (no toca los módulos ni suspende el local). */
export async function setSubscriptionCancelled(tenantId: string, cancelled: boolean) {
  await requirePlatformAdmin();
  await db.subscription.update({ where: { tenantId }, data: { cancelledAt: cancelled ? new Date() : null } });
  refresh(tenantId);
}
