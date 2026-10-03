"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Allergen, PrepStation } from "@/generated/prisma/enums";
import { checkbox, fail, optionalText, priceInput, success, type ActionState } from "@/lib/actions";
import { requireTenantRole } from "@/lib/auth/guards";
import { ADMIN_ROLES } from "@/lib/auth/permissions";
import { confirmImage, deleteImageByUrl } from "@/lib/storage";
import type { TenantDb } from "@/lib/tenant-db";

async function auth() {
  return requireTenantRole(ADMIN_ROLES);
}

function refresh(slug: string) {
  revalidatePath("/admin/carta", "layout");
  revalidatePath(`/${slug}`, "layout");
}

/** Mueve un elemento una posición arriba/abajo y renumera el orden. */
function reorder<T extends { id: string }>(items: T[], id: string, dir: "up" | "down") {
  const i = items.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return null;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((x, sortOrder) => ({ id: x.id, sortOrder }));
}

// ─────────────────────────────────────────────────────────────
// Categorías
// ─────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(40),
  description: optionalText,
});

export async function createCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);

  const last = await tdb.category.findFirst({ orderBy: { sortOrder: "desc" } });
  await tdb.category.create({
    data: { ...parsed.data, tenantId: tenant.id, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  refresh(tenant.slug);
  return success(`Categoría "${parsed.data.name}" creada`);
}

export async function renameCategory(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  await tdb.category.update({ where: { id }, data: parsed.data });
  refresh(tenant.slug);
  return success("Guardado");
}

export async function toggleCategoryVisible(id: string) {
  const { tdb, tenant } = await auth();
  const c = await tdb.category.findUniqueOrThrow({ where: { id } });
  await tdb.category.update({ where: { id }, data: { visible: !c.visible } });
  refresh(tenant.slug);
}

export async function moveCategory(id: string, dir: "up" | "down") {
  const { tdb, tenant } = await auth();
  const all = await tdb.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const next = reorder(all, id, dir);
  if (!next) return;
  await Promise.all(next.map((x) => tdb.category.update({ where: { id: x.id }, data: { sortOrder: x.sortOrder } })));
  refresh(tenant.slug);
}

export async function deleteCategory(id: string): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const count = await tdb.product.count({ where: { categoryId: id } });
  if (count > 0) return { error: "Mové o borrá sus productos antes de borrar la categoría" };
  await tdb.category.delete({ where: { id } });
  refresh(tenant.slug);
  return success("Categoría borrada");
}

// ─────────────────────────────────────────────────────────────
// Productos
// ─────────────────────────────────────────────────────────────

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Cada opción necesita un nombre").max(40),
  extraPriceCents: z.number().int().min(0).max(100000),
});

/** Campo oculto con una lista de opciones serializada como JSON. */
function optionsJson(min: number, minMessage = "Agregá al menos una opción") {
  return z
    .string()
    .default("[]")
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Opciones inválidas" });
        return z.NEVER;
      }
    })
    .pipe(z.array(optionSchema).min(min, minMessage).max(20, "Máximo 20 opciones"));
}

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Poné un nombre").max(80),
  description: optionalText.pipe(z.string().max(300, "Máximo 300 caracteres").nullable()),
  price: priceInput,
  categoryId: z.string().min(1, "Elegí una categoría"),
  station: z.enum(PrepStation),
  allergens: z.array(z.enum(Allergen)),
  modifierGroupIds: z.array(z.string()),
  tags: z
    .string()
    .transform((v) =>
      [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8),
    ),
  available: checkbox,
  visible: checkbox,
  /** "Extras de este plato": grupo propio del producto, no compartido. */
  ownExtras: optionsJson(0),
  /** "" = sin cambios · "remove" = quitar · otra cosa = clave de R2 recién subida. */
  imageKey: z.string().default(""),
});

/** Verifica que los ids recibidos del formulario pertenezcan al tenant. */
async function ownedIds(tdb: TenantDb, categoryId: string, groupIds: string[]) {
  const [category, groups] = await Promise.all([
    tdb.category.findUnique({ where: { id: categoryId } }),
    groupIds.length ? tdb.modifierGroup.findMany({ where: { id: { in: groupIds }, ownerProductId: null }, select: { id: true } }) : [],
  ]);
  return { categoryOk: !!category, groupIds: groupIds.filter((g) => groups.some((x) => x.id === g)) };
}

export async function saveProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const parsed = productSchema.safeParse({
    ...Object.fromEntries(formData),
    allergens: formData.getAll("allergens"),
    modifierGroupIds: formData.getAll("modifierGroupIds"),
  });
  if (!parsed.success) return fail(parsed.error);
  const { id, price, modifierGroupIds, ownExtras, imageKey, ...data } = parsed.data;

  const owned = await ownedIds(tdb, data.categoryId, modifierGroupIds);
  if (!owned.categoryOk) return { error: "Categoría no válida" };

  // Imagen: se valida que la clave sea de este local y que el archivo exista en R2.
  const previous = id ? await tdb.product.findUnique({ where: { id }, select: { imageUrl: true } }) : null;
  let imageUrl: string | null | undefined; // undefined = no tocar
  if (imageKey === "remove") imageUrl = null;
  else if (imageKey) {
    imageUrl = await confirmImage(tenant.id, imageKey);
    if (!imageUrl) return { error: "La foto no se pudo verificar. Volvé a subirla." };
  }
  const imageData = imageUrl === undefined ? {} : { imageUrl };

  await tdb.$transaction(async (tx) => {
    let productId = id;
    if (productId) {
      await tx.product.update({ where: { id: productId }, data: { ...data, ...imageData, priceCents: price } });
    } else {
      const last = await tx.product.findFirst({
        where: { categoryId: data.categoryId },
        orderBy: { sortOrder: "desc" },
      });
      const created = await tx.product.create({
        data: { ...data, ...imageData, tenantId: tenant.id, priceCents: price, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      productId = created.id;
    }

    // Extras propios: se crean/reemplazan con el producto, o se borran si quedó vacío.
    const own = await tx.modifierGroup.findUnique({ where: { ownerProductId: productId } });
    const rows = ownExtras.map((o, sortOrder) => ({ name: o.name, extraPriceCents: o.extraPriceCents, sortOrder }));
    let ownGroupId: string | null = null;
    if (rows.length) {
      const groupData = { name: "Extras", minSelect: 0, maxSelect: rows.length };
      const g = own
        ? await tx.modifierGroup.update({
            where: { id: own.id },
            data: { ...groupData, options: { deleteMany: {}, create: rows } },
          })
        : await tx.modifierGroup.create({
            data: { ...groupData, tenantId: tenant.id, ownerProductId: productId, options: { create: rows } },
          });
      ownGroupId = g.id;
    } else if (own) {
      await tx.modifierGroup.delete({ where: { id: own.id } });
    }

    // Orden en la ficha: grupos compartidos primero, extras propios al final.
    const links = [...owned.groupIds, ...(ownGroupId ? [ownGroupId] : [])].map((groupId, sortOrder) => ({
      groupId,
      sortOrder,
    }));
    await tx.product.update({
      where: { id: productId },
      data: { modifierGroups: { deleteMany: {}, create: links } },
    });
  });

  // La foto anterior se borra recién cuando el guardado salió bien.
  if (imageUrl !== undefined && previous?.imageUrl && previous.imageUrl !== imageUrl) {
    await deleteImageByUrl(tenant.id, previous.imageUrl);
  }

  refresh(tenant.slug);
  redirect(`/admin/carta?ok=${encodeURIComponent(id ? "Producto actualizado" : "Producto creado")}`);
}

export async function toggleProductFlag(id: string, flag: "available" | "visible") {
  const { tdb, tenant } = await auth();
  const p = await tdb.product.findUniqueOrThrow({ where: { id } });
  await tdb.product.update({ where: { id }, data: { [flag]: !p[flag] } });
  refresh(tenant.slug);
}

export async function moveProduct(id: string, dir: "up" | "down") {
  const { tdb, tenant } = await auth();
  const p = await tdb.product.findUniqueOrThrow({ where: { id } });
  const siblings = await tdb.product.findMany({
    where: { categoryId: p.categoryId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const next = reorder(siblings, id, dir);
  if (!next) return;
  await Promise.all(next.map((x) => tdb.product.update({ where: { id: x.id }, data: { sortOrder: x.sortOrder } })));
  refresh(tenant.slug);
}

export async function deleteProduct(id: string) {
  const { tdb, tenant } = await auth();
  // Los pedidos guardan copia de nombre/precio: borrar el producto no altera el historial.
  const p = await tdb.product.delete({ where: { id } });
  await deleteImageByUrl(tenant.id, p.imageUrl);
  refresh(tenant.slug);
  redirect(`/admin/carta?ok=${encodeURIComponent("Producto borrado")}`);
}

// ─────────────────────────────────────────────────────────────
// Grupos de modificadores
// ─────────────────────────────────────────────────────────────

const groupSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Poné un nombre").max(40),
    minSelect: z.coerce.number().int().min(0).max(10),
    maxSelect: z.coerce.number().int().min(1).max(10),
    options: optionsJson(1),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: "El mínimo no puede superar al máximo", path: ["minSelect"] })
  .refine((g) => g.maxSelect <= g.options.length, {
    message: "El máximo no puede superar la cantidad de opciones",
    path: ["maxSelect"],
  });

export async function saveModifierGroup(_: ActionState, formData: FormData): Promise<ActionState> {
  const { tdb, tenant } = await auth();
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { id, options, ...data } = parsed.data;
  const rows = options.map((o, sortOrder) => ({ name: o.name, extraPriceCents: o.extraPriceCents, sortOrder }));

  if (id) {
    // Las opciones se reemplazan: los pedidos ya guardan copia del nombre y precio elegidos.
    await tdb.modifierGroup.update({
      where: { id },
      data: { ...data, options: { deleteMany: {}, create: rows } },
    });
  } else {
    await tdb.modifierGroup.create({ data: { ...data, tenantId: tenant.id, options: { create: rows } } });
  }
  refresh(tenant.slug);
  return success(id ? "Grupo actualizado" : "Grupo creado");
}

export async function deleteModifierGroup(id: string) {
  const { tdb, tenant } = await auth();
  await tdb.modifierGroup.delete({ where: { id } });
  refresh(tenant.slug);
}
