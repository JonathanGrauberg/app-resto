"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ModuleKey } from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { hashSecret } from "@/lib/auth/password";
import { addMonths } from "@/lib/subscription";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { isCountry, regionSettingsFor } from "@/lib/region";
import { isValidSlug } from "@/lib/reserved-slugs";

export type CreateTenantState = { error?: string; ok?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, "Slug inválido: minúsculas, números y guiones (3–40), y no reservado"),
  ownerName: z.string().trim().min(2, "Nombre del dueño requerido"),
  ownerEmail: z.email("Email no válido").transform((v) => v.trim().toLowerCase()),
  ownerPassword: z.string().min(8, "La contraseña inicial debe tener al menos 8 caracteres"),
  country: z.string().refine(isCountry, "País no válido"),
  plan: z.string().refine((v) => PLANS.some((p) => p.id === v), "Plan no válido"),
  trialMonths: z.coerce.number().int().min(0).max(12),
});

export async function createTenant(_: CreateTenantState, formData: FormData): Promise<CreateTenantState> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (await db.tenant.findUnique({ where: { slug: d.slug } })) return { error: "Ese slug ya está en uso" };

  const passwordHash = await hashSecret(d.ownerPassword);

  const plan = PLANS.find((p) => p.id === d.plan)!;
  const tenant = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: d.slug,
        name: d.name,
        // País: moneda, zona horaria, medios de pago y textos legales del local.
        settings: { create: regionSettingsFor(d.country as "ES" | "AR") },
        // Módulos del plan elegido; se ajustan uno por uno desde la ficha del local.
        modules: { create: plan.modules.map((module) => ({ module })) },
        // Suscripción con la prueba gratis elegida; el precio se carga desde la ficha del local.
        subscription: {
          create: {
            planId: plan.id,
            currency: regionSettingsFor(d.country as "ES" | "AR").currency,
            trialEndsAt: d.trialMonths ? addMonths(new Date(), d.trialMonths) : null,
          },
        },
      },
    });
    const user = await tx.user.upsert({
      where: { email: d.ownerEmail },
      update: {},
      create: { email: d.ownerEmail, name: d.ownerName, passwordHash },
    });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    return tenant;
  });

  revalidatePath("/platform", "layout");
  redirect(`/platform/locales/${tenant.id}?ok=${encodeURIComponent(`Local "${d.name}" creado`)}`);
}

export async function toggleModule(tenantId: string, module: ModuleKey, enabled: boolean) {
  await requirePlatformAdmin();
  if (!Object.values(ModuleKey).includes(module)) throw new Error("Módulo inválido");

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module } },
    update: { enabled },
    create: { tenantId, module, enabled },
  });
  revalidatePath("/platform", "layout");
}

/** Vencimiento de un módulo (prueba gratis, plan pago hasta…). Vacío = sin vencimiento. */
export async function setModuleExpiry(tenantId: string, module: ModuleKey, formData: FormData) {
  await requirePlatformAdmin();
  if (!Object.values(ModuleKey).includes(module)) throw new Error("Módulo inválido");
  const raw = String(formData.get("expiresAt") ?? "");
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59Z`) : null;
  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module } },
    update: { expiresAt },
    create: { tenantId, module, enabled: true, expiresAt },
  });
  revalidatePath("/platform", "layout");
}

/** Deja el local exactamente con los módulos de un plan. */
export async function applyPlan(tenantId: string, planId: string) {
  await requirePlatformAdmin();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error("Plan inválido");
  await db.$transaction([
    db.tenantModule.updateMany({ where: { tenantId, module: { notIn: plan.modules } }, data: { enabled: false } }),
    ...plan.modules.map((module) =>
      db.tenantModule.upsert({
        where: { tenantId_module: { tenantId, module } },
        update: { enabled: true },
        create: { tenantId, module, enabled: true },
      }),
    ),
  ]);
  revalidatePath("/platform", "layout");
}

export async function toggleTenantActive(tenantId: string, active: boolean) {
  await requirePlatformAdmin();
  await db.tenant.update({ where: { id: tenantId }, data: { active } });
  revalidatePath("/platform", "layout");
}
