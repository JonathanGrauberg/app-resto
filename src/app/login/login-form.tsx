"use client";

import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/field";
import { ProCrown } from "@/components/pro-badge";
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
      <details className="rounded-xl border border-line px-3 py-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <ProCrown /> Ingresar código PRO
        </summary>
        <Input
          name="code"
          placeholder="PRO-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Código PRO"
          className="mt-2.5 font-mono uppercase tracking-widest"
        />
      </details>
      <FormError message={state?.error} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
