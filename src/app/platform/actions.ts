"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ModuleKey } from "@/generated/prisma/enums";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { hashSecret } from "@/lib/auth/password";
import { db } from "@/lib/db";
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
});

export async function createTenant(_: CreateTenantState, formData: FormData): Promise<CreateTenantState> {
  await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (await db.tenant.findUnique({ where: { slug: d.slug } })) return { error: "Ese slug ya está en uso" };

  const passwordHash = await hashSecret(d.ownerPassword);

  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: d.slug,
        name: d.name,
        settings: { create: {} },
        // Plan base: solo carta QR. El resto se activa desde la plataforma.
        modules: { create: [{ module: "CARTA_QR" }] },
      },
    });
    const user = await tx.user.upsert({
      where: { email: d.ownerEmail },
      update: {},
      create: { email: d.ownerEmail, name: d.ownerName, passwordHash },
    });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
  });

  revalidatePath("/platform");
  return { ok: `Local "${d.name}" creado en /${d.slug}` };
}

export async function toggleModule(tenantId: string, module: ModuleKey, enabled: boolean) {
  await requirePlatformAdmin();
  if (!Object.values(ModuleKey).includes(module)) throw new Error("Módulo inválido");

  await db.tenantModule.upsert({
    where: { tenantId_module: { tenantId, module } },
    update: { enabled },
    create: { tenantId, module, enabled },
  });
  revalidatePath("/platform");
}

export async function toggleTenantActive(tenantId: string, active: boolean) {
  await requirePlatformAdmin();
  await db.tenant.update({ where: { id: tenantId }, data: { active } });
  revalidatePath("/platform");
}
