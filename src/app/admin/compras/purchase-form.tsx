"use client";

import { useState } from "react";
import { useRegion } from "@/components/region-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Select } from "@/components/ui/field";
import { PURCHASE_CATEGORIES } from "@/lib/purchase-labels";
import { useFormAction } from "@/lib/use-form-action";
import { createPurchase } from "./actions";

/** Carga rápida: después de guardar, quedan la fecha, la categoría y el proveedor para la siguiente. */
export function PurchaseForm({ today }: { today: string }) {
  const { symbol, region } = useRegion();
  const [state, action, pending] = useFormAction(createPurchase, undefined);
  const fe = state?.fieldErrors ?? {};
  // Tras guardar se vacían concepto, cantidad, total y notas (cambia la key de esos campos).
  const [round, setRound] = useState(0);
  const [seenAt, setSeenAt] = useState(state?.at);
  if (state?.at && state.at !== seenAt) {
    setSeenAt(state.at);
    setRound((r) => r + 1);
  }

  return (
    <Card className="p-4 lg:sticky lg:top-8">
      <form onSubmit={action} className="space-y-4">
        <h2 className="font-semibold">Nueva compra</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="pu-date" error={fe.date}>
            <Input id="pu-date" name="date" type="date" defaultValue={today} max={today} required />
          </Field>
          <Field label="Categoría" htmlFor="pu-cat" error={fe.category}>
            <Select id="pu-cat" name="category" defaultValue="FOOD">
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div key={round} className="space-y-4">
          <Field label="Producto o concepto" htmlFor="pu-item" error={fe.item}>
            <Input id="pu-item" name="item" placeholder="Ej. Carne picada, Coca-Cola 2,25 L" required maxLength={80} autoFocus={round > 0} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad (opcional)" htmlFor="pu-qty" error={fe.quantity}>
              <Input id="pu-qty" name="quantity" placeholder="10 kg" maxLength={30} />
            </Field>
            <Field label={`Total (${symbol})`} htmlFor="pu-amount" error={fe.amount}>
              <Input
                id="pu-amount"
                name="amount"
                inputMode="decimal"
                placeholder={region.currency === "EUR" ? "125,50" : "85.000"}
                required
              />
            </Field>
          </div>
          <Field label="Notas (opcional)" htmlFor="pu-notes" error={fe.notes}>
            <Input id="pu-notes" name="notes" maxLength={200} placeholder="N.º de factura, forma de pago…" />
          </Field>
        </div>
        <Field label="Proveedor (opcional)" htmlFor="pu-supplier" error={fe.supplier}>
          <Input id="pu-supplier" name="supplier" maxLength={60} placeholder="Ej. Distribuidora del Litoral" />
        </Field>
        <FormError message={state?.error} />
        <FormSuccess message={state?.ok} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Guardando…" : "Cargar compra"}
        </Button>
      </form>
    </Card>
  );
}
