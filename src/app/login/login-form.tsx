"use client";

import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/field";
import { loginWithPassword } from "./actions";
import { useFormAction } from "@/lib/use-form-action";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useFormAction(loginWithPassword, undefined);

  return (
    <form onSubmit={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError message={state?.error} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
