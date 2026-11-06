"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashSecret } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { normalize } from "@/lib/format";
import { FREE_PLAN_ID, planById } from "@/lib/plans";
import { redeemProCode } from "@/lib/pro";
import { isCountry, regionSettingsFor } from "@/lib/region";
import { isValidSlug } from "@/lib/reserved-slugs";

export type SignupState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z.object({
  venue: z.string().trim().min(2, "Poné el nombre del local").max(60),
  country: z.string().refine(isCountry, "Elegí el país"),
  city: z.string().trim().min(2, "Poné la ciudad").max(60),
  name: z.string().trim().min(2, "Poné tu nombre").max(60),
  email: z.email("Email no válido").transform((v) => v.trim().toLowerCase()),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Poné tu WhatsApp con código de área"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
  code: z.string().trim().max(20).optional(),
  /** Campo trampa: las personas no lo ven; los bots lo completan. */
  website: z.string().max(0).optional(),
});

/** WhatsApp con código de país (+549… en Argentina, +34… en España), para poder escribirle directo. */
function intlPhone(raw: string, country: string) {
  let d = raw.replace(/\D/g, "");
  if (country === "AR" && !d.startsWith("54")) d = `549${d.replace(/^0/, "")}`;
  if (country === "ES" && !d.startsWith("34")) d = `34${d}`;
  return `+${d}`;
}

/** "La Parrilla de Don José" → "la-parrilla-de-don-jose"; si está tomado, "-2", "-3"… */
async function freeSlug(venue: string) {
  let base = normalize(venue)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34)
    .replace(/-+$/, "");
  if (base.length < 3) base = `local-${base}`.replace(/-+$/, "");
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (isValidSlug(slug) && !(await db.tenant.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Alta de un local desde la web: arranca en el plan Gratis; con un código PRO, directo en su plan. */
export async function signup(_: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) if (i.path[0] && !fieldErrors[String(i.path[0])]) fieldErrors[String(i.path[0])] = i.message;
    return { error: "Revisá los campos marcados", fieldErrors };
  }
  const d = parsed.data;

  // Una cuenta por email: si ya existe, que inicie sesión (no se pisa una cuenta ajena).
  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } })) {
    return { error: "Ya hay una cuenta con ese email. Iniciá sesión con tu contraseña.", fieldErrors: { email: "Ya registrado" } };
  }

  const region = regionSettingsFor(d.country as "AR" | "ES");
  const plan = planById(FREE_PLAN_ID)!;
  const slug = await freeSlug(d.venue);
  const passwordHash = await hashSecret(d.password);

  const { tenant, user, membership } = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: d.venue,
        settings: { create: region },
        modules: { create: plan.modules.map((module) => ({ module })) },
        subscription: {
          create: { planId: plan.id, currency: region.currency, source: "registro", city: d.city, contactPhone: intlPhone(d.phone, d.country) },
        },
      },
    });
    const user = await tx.user.create({ data: { email: d.email, name: d.name, passwordHash } });
    const membership = await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    return { tenant, user, membership };
  });

  await createSession({ userId: user.id, tenantId: tenant.id, membershipId: membership.id, kind: "password" });

  // Si vino con un código PRO, se activa ya (si falla, igual queda registrado en Gratis).
  const pro = d.code ? ((await redeemProCode(tenant.id, d.code)).ok ? "1" : "0") : null;

  await notifyTeam({ venue: d.venue, slug, city: d.city, country: d.country, name: d.name, email: d.email, phone: d.phone });

  redirect(`/admin/plan?bienvenida=1${pro ? `&pro=${pro}` : ""}`);
}

/** Aviso al equipo de Yatay (admins de plataforma) de que se registró un local nuevo. */
async function notifyTeam(n: { venue: string; slug: string; city: string; country: string; name: string; email: string; phone: string }) {
  const admins = await db.user.findMany({ where: { isPlatformAdmin: true, email: { not: null } }, select: { email: true } });
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<p><strong>${esc(n.venue)}</strong> (${esc(n.city)}, ${esc(n.country)}) se registró en ${BRAND.name}.</p>
<p>${esc(n.name)} · ${esc(n.email)} · ${esc(n.phone)}</p><p>Carta: /${esc(n.slug)}</p>`;
  await Promise.all(admins.map((a) => sendEmail({ to: a.email!, subject: `Nuevo local: ${n.venue} (${n.city})`, html })));
}
