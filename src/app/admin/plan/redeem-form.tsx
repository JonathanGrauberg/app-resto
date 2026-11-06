"use client";

import { Button } from "@/components/ui/button";
import { FormError, FormSuccess, Input, Label } from "@/components/ui/field";
import { useFormAction } from "@/lib/use-form-action";
import { redeemCode } from "./actions";

/** "Tengo un código PRO". */
export function RedeemForm() {
  const [state, action, pending] = useFormAction(redeemCode, undefined);
  return (
    <form onSubmit={action} className="space-y-3">
      <div>
        <Label htmlFor="code">Código PRO</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            name="code"
            required
            placeholder="PRO-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase tracking-widest"
          />
          <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? "Activando…" : "Activar"}
          </Button>
        </div>
      </div>
      <FormError message={state?.error} />
      <FormSuccess message={state?.ok} />
    </form>
  );
}
