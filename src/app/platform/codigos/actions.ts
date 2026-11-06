"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PLANS, PRO_CODE_VALIDITY } from "@/lib/plans";
import { createProCode } from "@/lib/pro";

export type CodeState = { error?: string; code?: string; at?: number } | undefined;

const schema = z.object({
  planId: z.string().refine((v) => PLANS.some((p) => p.id === v), "Plan no válido"),
  /** "1".."24" meses, o "vip" = sin vencimiento y sin cargo. */
  duration: z.string().refine((v) => v === "vip" || /^([1-9]|1\d|2[0-4])$/.test(v), "Duración no válida"),
  tenantId: z.string().trim(),
  validMinutes: z.coerce.number().refine((v) => PRO_CODE_VALIDITY.some((x) => x.minutes === v), "Vigencia no válida"),
  note: z.string().trim().max(120),
});

export async function generateCode(_: CodeState, formData: FormData): Promise<CodeState> {
  const { user } = await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.tenantId && !(await db.tenant.findUnique({ where: { id: d.tenantId }, select: { id: true } }))) return { error: "Local no encontrado" };
  const vip = d.duration === "vip";
  const code = await createProCode({
    planId: d.planId,
    months: vip ? null : Number(d.duration),
    vip,
    tenantId: d.tenantId || null,
    validMinutes: d.validMinutes,
    note: d.note || null,
    createdBy: user.name,
  });
  revalidatePath("/platform/codigos");
  return { code, at: Date.now() };
}

/** Anula un código sin usar (por ejemplo, si se mandó al local equivocado). */
export async function voidCode(id: string) {
  await requirePlatformAdmin();
  await db.proCode.updateMany({ where: { id, usedAt: null }, data: { expiresAt: new Date() } });
  revalidatePath("/platform/codigos");
}
