"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MenuTheme, PrepMode } from "@/generated/prisma/enums";
import { fail, optionalText, optionalUrl, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { confirmImage, deleteImageByUrl } from "@/lib/storage";

const schema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(60),
  tagline: optionalText.pipe(z.string().max(90, "Máximo 90 caracteres").nullable()),
  description: optionalText.pipe(z.string().max(400, "Máximo 400 caracteres").nullable()),
  address: optionalText,
  phone: optionalText,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  websiteUrl: optionalUrl,
  googleReviewUrl: optionalUrl,
  menuTheme: z.enum(MenuTheme),
  prepMode: z.enum(PrepMode),
  coverKey: z.string().default(""),
  logoKey: z.string().default(""),
  shareKey: z.string().default(""),
});

/** "" = sin cambios · "remove" = quitar · clave = nueva imagen (validada contra R2). */
async function resolveImage(tenantId: string, key: string) {
  if (!key) return { change: false as const };
  if (key === "remove") return { change: true as const, url: null };
  const url = await confirmImage(tenantId, key);
  return url ? { change: true as const, url } : { error: true as const };
}

export async function updateSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { name, coverKey, logoKey, shareKey, ...settings } = parsed.data;

  const [cover, logo, share] = await Promise.all([
    resolveImage(tenant.id, coverKey),
    resolveImage(tenant.id, logoKey),
    resolveImage(tenant.id, shareKey),
  ]);
  if ("error" in cover || "error" in logo || "error" in share) {
    return { error: "Una de las imágenes no se pudo verificar. Volvé a subirla." };
  }
  const previous = await db.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
  const images = {
    ...(cover.change ? { coverImageUrl: cover.url } : {}),
    ...(logo.change ? { logoUrl: logo.url } : {}),
    ...(share.change ? { shareImageUrl: share.url } : {}),
  };

  // Tenant y TenantSettings se identifican por el tenant de la sesión, nunca por el formulario.
  await db.$transaction([
    db.tenant.update({ where: { id: tenant.id }, data: { name } }),
    db.tenantSettings.upsert({
      where: { tenantId: tenant.id },
      update: { ...settings, ...images },
      create: { tenantId: tenant.id, ...settings, ...images },
    }),
  ]);

  // Se borra la anterior solo si realmente cambió (re-guardar la misma clave no debe borrarla).
  if (cover.change && previous?.coverImageUrl && previous.coverImageUrl !== cover.url) {
    await deleteImageByUrl(tenant.id, previous.coverImageUrl);
  }
  if (logo.change && previous?.logoUrl && previous.logoUrl !== logo.url) {
    await deleteImageByUrl(tenant.id, previous.logoUrl);
  }
  if (share.change && previous?.shareImageUrl && previous.shareImageUrl !== share.url) {
    await deleteImageByUrl(tenant.id, previous.shareImageUrl);
  }

  revalidatePath("/admin", "layout");
  revalidatePath(`/${tenant.slug}`, "layout");
  return success("Cambios guardados");
}
