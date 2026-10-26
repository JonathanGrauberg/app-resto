"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkbox, fail, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { FIXED_TYPES, isLinkTheme, MAX_CUSTOM } from "@/lib/links";

const item = z.object({
  type: z.enum(["custom", ...FIXED_TYPES]),
  enabled: z.boolean(),
  value: z.string().trim().max(300).optional(),
  label: z.string().trim().max(40).optional(),
});

/** Guarda la página de enlaces: si se muestra, el fondo y los botones (en orden). */
export async function saveLinks(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireTenantRole(ADMIN_ROLES);
  const parsed = z
    .object({
      linksEnabled: checkbox,
      linksTheme: z.string().refine(isLinkTheme, "Fondo no válido"),
      links: z
        .string()
        .transform((v, ctx) => {
          try {
            return JSON.parse(v) as unknown;
          } catch {
            ctx.addIssue({ code: "custom", message: "Enlaces inválidos" });
            return z.NEVER;
          }
        })
        .pipe(z.array(item).max(FIXED_TYPES.length + MAX_CUSTOM)),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { linksEnabled, linksTheme, links } = parsed.data;
  if (links.filter((l) => l.type === "custom").length > MAX_CUSTOM) return { error: `Hasta ${MAX_CUSTOM} enlaces propios` };
  const bad = links.find((l) => l.type === "custom" && l.enabled && (!l.label || !l.value));
  if (bad) return { error: "Cada enlace propio necesita un texto y una dirección" };

  await db.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: { linksEnabled, linksTheme, links },
    create: { tenantId: tenant.id, linksEnabled, linksTheme, links },
  });
  revalidatePath("/admin/enlaces");
  revalidatePath(`/${tenant.slug}`, "layout");
  return success(linksEnabled ? "Guardado: al escanear el QR se ve primero esta página" : "Guardado (la página está apagada)");
}
