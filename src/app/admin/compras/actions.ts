"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PurchaseCategory } from "@/generated/prisma/enums";
import { fail, optionalText, priceInput, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { isValidDate } from "@/lib/booking";
import { purchaseDate } from "@/lib/purchases";
import { getRegion } from "@/lib/region-server";

const auth = () => requireTenantRole(ADMIN_ROLES, "COMPRAS");

export async function createPurchase(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant, membership } = await auth();
  const region = await getRegion(tenant.id);
  const parsed = z
    .object({
      date: z.string().refine(isValidDate, "Fecha no válida"),
      item: z.string().trim().min(1, "¿Qué compraste?").max(80),
      quantity: optionalText.pipe(z.string().max(30, "Máximo 30 caracteres").nullable()),
      supplier: optionalText.pipe(z.string().max(60, "Máximo 60 caracteres").nullable()),
      category: z.enum(PurchaseCategory),
      amount: priceInput(region),
      notes: optionalText.pipe(z.string().max(200, "Máximo 200 caracteres").nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { date, amount, ...d } = parsed.data;
  if (amount <= 0) return { error: "El total tiene que ser mayor que cero", fieldErrors: { amount: "Mayor que cero" } };

  await tdb.purchase.create({
    data: { ...d, tenantId: tenant.id, date: purchaseDate(date, region.timezone), amountCents: amount, createdById: membership.id },
  });
  revalidatePath("/admin/compras");
  revalidatePath("/admin");
  return success(`${d.item} cargado`);
}

export async function deletePurchase(id: string): Promise<ActionState> {
  const { tdb } = await auth();
  await tdb.purchase.deleteMany({ where: { id } });
  revalidatePath("/admin/compras");
  revalidatePath("/admin");
  return success("Compra borrada");
}
