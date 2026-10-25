/**
 * Cobro del SaaS (lo que el local le paga a Yatay): en qué estado está su suscripción.
 * No confundir con `billing.ts`, que calcula la cuenta de una mesa.
 * Sin servidor ni base: se usa en la plataforma y en el aviso del panel del local.
 */

const DAY = 86_400_000;

/** Meses de prueba gratis por defecto al dar de alta un local (lanzamiento: 3 meses). */
export const TRIAL_MONTHS = 3;
/** Días de gracia después del vencimiento antes de avisar en rojo. */
export const GRACE_DAYS = 5;

export const PAYMENT_METHODS = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  MERCADOPAGO: "Mercado Pago",
  STRIPE: "Stripe",
  OTRO: "Otro",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

type Sub = { priceCents: number; trialEndsAt: Date | null; paidUntil: Date | null; cancelledAt: Date | null } | null;

export type BillingState =
  | { kind: "none" }
  | { kind: "cancelled" }
  | { kind: "free" }
  | { kind: "active"; until: Date; daysLeft: number }
  | { kind: "trial"; until: Date; daysLeft: number }
  | { kind: "overdue"; since: Date | null; days: number };

export function billingState(sub: Sub, now = Date.now()): BillingState {
  if (!sub) return { kind: "none" };
  if (sub.cancelledAt) return { kind: "cancelled" };
  if (sub.paidUntil && sub.paidUntil.getTime() > now) return { kind: "active", until: sub.paidUntil, daysLeft: Math.ceil((sub.paidUntil.getTime() - now) / DAY) };
  if (sub.trialEndsAt && sub.trialEndsAt.getTime() > now && !sub.paidUntil) {
    return { kind: "trial", until: sub.trialEndsAt, daysLeft: Math.ceil((sub.trialEndsAt.getTime() - now) / DAY) };
  }
  if (sub.priceCents === 0) return { kind: "free" };
  const since = [sub.paidUntil, sub.trialEndsAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { kind: "overdue", since, days: since ? Math.floor((now - since.getTime()) / DAY) : 0 };
}

export const BILLING_LABEL: Record<BillingState["kind"], string> = {
  none: "Sin configurar",
  cancelled: "Dado de baja",
  free: "Sin cargo",
  active: "Al día",
  trial: "En prueba",
  overdue: "Vencido",
};

export const BILLING_TONE: Record<BillingState["kind"], "ok" | "warn" | "danger" | "neutral"> = {
  none: "neutral",
  cancelled: "neutral",
  free: "neutral",
  active: "ok",
  trial: "warn",
  overdue: "danger",
};

/** Suma meses respetando el día (31 ene + 1 mes = 28/29 feb). */
export function addMonths(d: Date, months: number) {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * Desde cuándo cuenta un pago nuevo: a continuación de lo ya pago, o del fin de la prueba gratis
 * (no se pierden los días de prueba); si ya venció todo, desde hoy.
 */
export function nextPeriodStart(sub: Sub, now = Date.now()) {
  const t = Math.max(now, sub?.paidUntil?.getTime() ?? 0, sub?.trialEndsAt?.getTime() ?? 0);
  return new Date(t);
}

/** Hoy como "AAAA-MM-DD" (para el valor por defecto de un campo de fecha). */
export const todayISO = () => new Date().toISOString().slice(0, 10);
