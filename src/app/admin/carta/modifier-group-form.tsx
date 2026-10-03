"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import { deleteModifierGroup, saveModifierGroup } from "./actions";
import { useFormAction } from "@/lib/use-form-action";

type Option = { key: string; name: string; extra: string };
export type GroupValues = {
  id?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: { name: string; extraPriceCents: number }[];
  usedBy?: number;
};

let seq = 0;
const newKey = () => `o${++seq}`;
const toOption = (o: { name: string; extraPriceCents: number }): Option => ({
  key: newKey(),
  name: o.name,
  extra: o.extraPriceCents ? (o.extraPriceCents / 100).toFixed(2).replace(".", ",") : "",
});

export function ModifierGroupForm({ values }: { values: GroupValues }) {
  const [state, action, pending] = useFormAction(saveModifierGroup, undefined);
  const [options, setOptions] = useState<Option[]>(() =>
    values.options.length ? values.options.map(toOption) : [toOption({ name: "", extraPriceCents: 0 })],
  );
  const fe = state?.fieldErrors ?? {};

  // Formulario de alta: tras crear, se vacía (ajuste de estado durante el render, sin efecto).
  const [handledAt, setHandledAt] = useState<number>();
  if (state?.at && state.at !== handledAt) {
    setHandledAt(state.at);
    if (!values.id) setOptions([toOption({ name: "", extraPriceCents: 0 })]);
  }

  const serialized = JSON.stringify(
    options
      .filter((o) => o.name.trim())
      .map((o) => ({
        name: o.name.trim(),
        extraPriceCents: Math.max(0, Math.round(Number(o.extra.replace(",", ".") || "0") * 100) || 0),
      })),
  );

  const update = (key: string, patch: Partial<Option>) =>
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={action} key={values.id ?? `new-${handledAt ?? 0}`} className="space-y-4">
        {values.id && <input type="hidden" name="id" value={values.id} />}
        <input type="hidden" name="options" value={serialized} />

        <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
          <Field label="Nombre del grupo" htmlFor={`name-${values.id ?? "new"}`} error={fe.name}>
            <Input id={`name-${values.id ?? "new"}`} name="name" defaultValue={values.name} placeholder="Ej. Punto de la carne" required />
          </Field>
          <Field label="Mínimo" htmlFor={`min-${values.id ?? "new"}`} hint="0 = opcional" error={fe.minSelect}>
            <Input id={`min-${values.id ?? "new"}`} name="minSelect" type="number" min={0} max={10} defaultValue={values.minSelect} />
          </Field>
          <Field label="Máximo" htmlFor={`max-${values.id ?? "new"}`} hint="1 = elige una" error={fe.maxSelect}>
            <Input id={`max-${values.id ?? "new"}`} name="maxSelect" type="number" min={1} max={10} defaultValue={values.maxSelect} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Opciones</p>
          <div className="space-y-2">
            {options.map((o) => (
              <div key={o.key} className="flex gap-2">
                <Input
                  value={o.name}
                  onChange={(e) => update(o.key, { name: e.target.value })}
                  placeholder="Opción (ej. Al punto)"
                  aria-label="Nombre de la opción"
                  className="flex-1"
                />
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">+€</span>
                  <Input
                    value={o.extra}
                    onChange={(e) => update(o.key, { extra: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label="Precio extra"
                    className="pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOptions((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== o.key) : prev))}
                  aria-label="Quitar opción"
                  className="shrink-0 rounded-lg p-2.5 text-muted hover:bg-ink/5 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          {fe.options && <p className="mt-1 text-xs text-danger">{fe.options}</p>}
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, toOption({ name: "", extraPriceCents: 0 })])}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand"
          >
            <Plus className="size-4" aria-hidden /> Añadir opción
          </button>
        </div>

        <FormError message={state?.error} />
        <FormSuccess message={values.id ? state?.ok : undefined} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {values.id ? (
            <ActionButton
              action={() => deleteModifierGroup(values.id!)}
              confirm={`¿Borrar el grupo "${values.name}"?${values.usedBy ? ` Lo usan ${values.usedBy} productos.` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger-soft"
            >
              <Trash2 className="size-4" aria-hidden /> Borrar grupo
            </ActionButton>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : values.id ? "Guardar" : "Crear grupo"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
