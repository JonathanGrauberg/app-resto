"use client";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { ProCrown } from "@/components/pro-badge";
import { useFormAction } from "@/lib/use-form-action";
import { signup } from "./actions";

export function SignupForm({ withCode }: { withCode: boolean }) {
  const [state, action, pending] = useFormAction(signup, undefined);
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form onSubmit={action} className="space-y-4" noValidate>
      <Field label="Nombre del local" htmlFor="venue" error={err("venue")}>
        <Input id="venue" name="venue" required maxLength={60} placeholder="Ej. La Parrilla de Don José" autoComplete="organization" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="País" htmlFor="country" error={err("country")}>
          <Select id="country" name="country" defaultValue="AR">
            <option value="AR">Argentina</option>
            <option value="ES">España</option>
          </Select>
        </Field>
        <Field label="Ciudad" htmlFor="city" error={err("city")}>
          <Input id="city" name="city" required maxLength={60} placeholder="Paraná" autoComplete="address-level2" />
        </Field>
      </div>
      <Field label="Tu nombre" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" required maxLength={60} autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" error={err("email")} hint="Con este email vas a entrar al panel.">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="WhatsApp" htmlFor="phone" error={err("phone")} hint="Para ayudarte a arrancar. No lo mostramos en ningún lado.">
        <Input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="343 555 1234" />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={err("password")} hint="Mínimo 8 caracteres.">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>

      <details open={withCode} className="group rounded-xl border border-line px-4 py-3 open:pb-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <ProCrown /> Tengo un código PRO
        </summary>
        <Input
          name="code"
          placeholder="PRO-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Código PRO"
          className="mt-3 font-mono uppercase tracking-widest"
        />
      </details>

      {/* Trampa para bots: oculto para las personas. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          No completar <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <FormError message={state?.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creando tu local…" : "Crear mi local gratis"}
      </Button>
    </form>
  );
}
