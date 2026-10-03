"use client";

import { useState } from "react";
import Link from "next/link";
import type { Allergen, PrepStation } from "@/generated/prisma/enums";
import { ImageUpload } from "@/components/image-upload";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { ALLERGENS, ALLERGEN_KEYS } from "@/lib/allergens";
import { cn, formatPrice } from "@/lib/format";
import { saveProduct } from "./actions";
import { OwnExtrasEditor, type Extra } from "./own-extras-editor";
import { useFormAction } from "@/lib/use-form-action";

export type ProductValues = {
  id?: string;
  imageUrl: string | null;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  station: PrepStation;
  allergens: Allergen[];
  modifierGroupIds: string[];
  ownExtras: Extra[];
  tags: string;
  available: boolean;
  visible: boolean;
};

const STATIONS: { value: PrepStation; label: string; hint: string }[] = [
  { value: "KITCHEN", label: "Cocina", hint: "Va a la pantalla de cocina" },
  { value: "BAR", label: "Bar", hint: "Va a la pantalla de barra" },
  { value: "NONE", label: "Sin preparación", hint: "Lo entrega el mozo directo" },
];

export function ProductForm({
  values,
  categories,
  groups,
}: {
  values: ProductValues;
  categories: { id: string; name: string }[];
  groups: { id: string; name: string; summary: string }[];
}) {
  const [state, action, pending] = useFormAction(saveProduct, undefined);
  const fe = state?.fieldErrors ?? {};
  // Vista previa en vivo de la tarjeta de la carta.
  const [name, setName] = useState(values.name);
  const [price, setPrice] = useState(values.price);
  const [station, setStation] = useState(values.station);
  const previewCents = Math.round(Number(price.replace(",", ".")) * 100);

  return (
    <form onSubmit={action} className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="space-y-6">
        <Card className="space-y-4 p-4 sm:p-6">
          <Field label="Nombre" htmlFor="name" error={fe.name}>
            <Input id="name" name="name" defaultValue={values.name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </Field>
          <Field label="Descripción" htmlFor="description" hint="Ingredientes o cómo se sirve. Máx. 300 caracteres." error={fe.description}>
            <Textarea id="description" name="description" defaultValue={values.description} maxLength={300} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio (€)" htmlFor="price" hint="IVA incluido. Ej.: 9,50" error={fe.price}>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={values.price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </Field>
            <Field label="Categoría" htmlFor="categoryId" error={fe.categoryId}>
              <Select id="categoryId" name="categoryId" defaultValue={values.categoryId} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Etiquetas" htmlFor="tags" hint="Separadas por coma: vegano, picante, casera… También sirven para el buscador." error={fe.tags}>
            <Input id="tags" name="tags" defaultValue={values.tags} />
          </Field>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-semibold">¿Dónde se prepara?</h2>
          <p className="mb-3 text-sm text-muted">Define a qué pantalla llega cuando se pide.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {STATIONS.map((s) => (
              <label
                key={s.value}
                className="cursor-pointer rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  type="radio"
                  name="station"
                  value={s.value}
                  defaultChecked={values.station === s.value}
                  onChange={() => setStation(s.value)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.hint}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-semibold">Alérgenos</h2>
          <p className="mb-3 text-sm text-muted">
            Obligatorio informar los 14 alérgenos del Reglamento UE 1169/2011 (también en bebidas).
          </p>
          <div className="flex flex-wrap gap-2">
            {ALLERGEN_KEYS.map((a) => (
              <label
                key={a}
                className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-warn has-[:checked]:bg-warn-soft has-[:checked]:text-warn"
              >
                <input type="checkbox" name="allergens" value={a} defaultChecked={values.allergens.includes(a)} className="sr-only" />
                {ALLERGENS[a].label}
              </label>
            ))}
          </div>
        </Card>

        <Card className="space-y-6 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">Extras de este plato</h2>
            <p className="mb-3 text-sm text-muted">Lo que el comensal puede sumar o quitar al pedir.</p>
            <OwnExtrasEditor initial={values.ownExtras} />
          </div>

          <div className="border-t border-line pt-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-semibold">Grupos compartidos</h2>
              <p className="text-sm text-muted">Opciones que se reutilizan en varios platos (punto de la carne, hielo…).</p>
            </div>
            <Link href="/admin/carta/modificadores" className="text-sm font-medium text-brand">
              {groups.length ? "Editar grupos" : "Crear grupo"}
            </Link>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay grupos compartidos.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {groups.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input
                    type="checkbox"
                    name="modifierGroupIds"
                    value={g.id}
                    defaultChecked={values.modifierGroupIds.includes(g.id)}
                    className="mt-0.5 size-4 accent-[var(--brand)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{g.name}</span>
                    <span className="block text-xs text-muted">{g.summary}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-8">
        <Card className="overflow-hidden">
          <ImageUpload
            name="imageKey"
            kind="product"
            initialUrl={values.imageUrl}
            seed={values.id ?? "nuevo-producto"}
            label={name || "Foto del plato"}
            className="aspect-[4/3] w-full"
            hintClassName="px-4"
            overlay={
              <>
                <p className={cn("text-lg font-semibold leading-tight", !name && "text-muted")}>{name || "Nombre del plato"}</p>
                <p className="font-semibold tabular-nums">{Number.isFinite(previewCents) ? formatPrice(previewCents) : "—"}</p>
              </>
            }
          />
          <p className="px-4 pb-4 pt-1 text-xs text-muted">
            Así se ve en la carta ({station === "BAR" ? "bar" : station === "KITCHEN" ? "cocina" : "sin preparación"}).
          </p>
        </Card>

        <Card className="space-y-4 p-4">
          <Switch name="available" defaultChecked={values.available} label="Disponible" description="Apagalo cuando se agote" />
          <Switch name="visible" defaultChecked={values.visible} label="Visible en la carta" description="Ocultalo sin borrarlo" />
          <FormError message={state?.error} />
          <div className="flex gap-2">
            <ButtonLink href="/admin/carta" variant="secondary" className="flex-1">
              Cancelar
            </ButtonLink>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Guardando…" : values.id ? "Guardar" : "Crear"}
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
