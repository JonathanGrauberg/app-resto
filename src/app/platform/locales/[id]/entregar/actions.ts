"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkbox, fail, type ActionState } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { hashSecret } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { handOverTenant } from "@/lib/hand-over";
import { intlPhone } from "@/lib/phone";
import { planById, PLANS } from "@/lib/plans";
import { regionOf } from "@/lib/region";

const schema = z.object({
  ownerName: z.string().trim().min(2, "Nombre demasiado corto").max(60),
  ownerEmail: z.email("Email no válido").transform((v) => v.trim().toLowerCase()),
  ownerPassword: z.string(),
  phone: z.string().trim().max(30),
  planId: z.string().refine((v) => PLANS.some((p) => p.id === v), "Plan no válido"),
  trialUntil: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha no válida"),
  keepMenu: checkbox,
  keepTables: checkbox,
  keepBranding: checkbox,
  keepSettings: checkbox,
  keepStaff: checkbox,
  confirm: z.string().trim().toLowerCase(),
});

/** "Entregar al cliente" desde la ficha del local en la plataforma (ver `handOverTenant`). */
export async function handOver(tenantId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { settings: { select: { country: true, currency: true } } } });
  if (!tenant) return { error: "Local no encontrado" };
  if (d.confirm !== tenant.slug) return { error: `Para confirmar, escribí "${tenant.slug}"`, fieldErrors: { confirm: "No coincide" } };
  const plan = planById(d.planId)!;

  // Si el email ya tiene cuenta, se usa esa (con su contraseña de siempre); si no, se crea con la que escriban.
  const existing = await db.user.findUnique({ where: { email: d.ownerEmail } });
  if (!existing && d.ownerPassword.length < 8) {
    return { error: "Revisá los campos marcados", fieldErrors: { ownerPassword: "Mínimo 8 caracteres" } };
  }
  const passwordHash = existing ? null : await hashSecret(d.ownerPassword);
  const country = tenant.settings?.country ?? "AR";

  await handOverTenant(tenantId, {
    owner: existing ? { userId: existing.id } : { name: d.ownerName, email: d.ownerEmail, passwordHash: passwordHash! },
    phone: d.phone ? intlPhone(d.phone, country) : null,
    plan,
    currency: regionOf(tenant.settings).currency,
    trialEndsAt: d.trialUntil ? new Date(`${d.trialUntil}T23:59:59Z`) : null,
    keep: { menu: d.keepMenu, tables: d.keepTables, branding: d.keepBranding, settings: d.keepSettings, staff: d.keepStaff },
  });

  revalidatePath("/platform", "layout");
  revalidatePath("/admin", "layout");
  const msg = existing
    ? `Local entregado a ${d.ownerEmail}. Ya tenía cuenta: entra con su contraseña de siempre.`
    : `Local entregado a ${d.ownerEmail}. Ya puede entrar con su email y la contraseña que eligió.`;
  redirect(`/platform/locales/${tenantId}?ok=${encodeURIComponent(msg)}`);
}
