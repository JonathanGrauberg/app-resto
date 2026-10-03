"use server";

import { z } from "zod";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { createImageUpload, IMAGE_KINDS, IMAGE_TYPES, MAX_IMAGE_BYTES, storageConfigured, type ImageType } from "@/lib/storage";

const schema = z.object({
  kind: z.enum(IMAGE_KINDS),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, "La imagen comprimida supera 3 MB"),
  type: z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]),
});

/** Pide una URL firmada para subir una imagen del local. */
export async function requestImageUpload(input: { kind: string; size: number; type: string }) {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  if (!storageConfigured()) return { error: "El almacenamiento de imágenes no está configurado" } as const;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Imagen no válida" } as const;
  return createImageUpload(tenant.id, parsed.data.kind, parsed.data.size, parsed.data.type);
}
