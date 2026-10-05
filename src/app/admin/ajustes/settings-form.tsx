"use client";

import type { MenuTheme, PrepMode } from "@/generated/prisma/enums";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, FormSuccess, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { updateSettings } from "./actions";
import { useFormAction } from "@/lib/use-form-action";

export type SettingsValues = {
  coverImageUrl: string | null;
  logoUrl: string | null;
  shareImageUrl: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  googleReviewUrl: string | null;
  menuTheme: MenuTheme;
  prepMode: PrepMode;
};

const THEMES: { value: MenuTheme; label: string; hint: string; preview: string }[] = [
  { value: "DARK", label: "Oscuro", hint: "Elegante, ideal para bares y cenas", preview: "bg-[#0b0a09] text-[#f5f2ed]" },
  { value: "LIGHT", label: "Claro", hint: "Luminoso, ideal para cafeterías y brunch", preview: "bg-[#fbfaf7] text-[#1a1714]" },
  { value: "SYSTEM", label: "Automático", hint: "Según el celular de cada comensal", preview: "bg-gradient-to-r from-[#fbfaf7] from-50% to-[#0b0a09] to-50% text-[#9a6b1f]" },
];

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, action, pending] = useFormAction(updateSettings, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form onSubmit={action} className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Section title="Local" description="Lo que ve el comensal en la portada de la carta.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name" error={fe.name} className="sm:col-span-2">
              <Input id="name" name="name" defaultValue={values.name} required />
            </Field>
            <Field label="Lema" htmlFor="tagline" hint="Frase corta bajo el nombre" error={fe.tagline} className="sm:col-span-2">
              <Input id="tagline" name="tagline" defaultValue={values.tagline ?? ""} maxLength={90} />
            </Field>
            <Field label="Descripción" htmlFor="description" hint="Se usa en buscadores y al compartir el enlace" error={fe.description} className="sm:col-span-2">
              <Textarea id="description" name="description" defaultValue={values.description ?? ""} maxLength={400} />
            </Field>
            <Field label="Dirección" htmlFor="address" error={fe.address}>
              <Input id="address" name="address" defaultValue={values.address ?? ""} />
            </Field>
            <Field label="Teléfono" htmlFor="phone" error={fe.phone}>
              <Input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ""} />
            </Field>
          </div>
        </Section>

        <Section title="Imágenes" description="Portada y logo de la carta. Se les aplica el degradado automáticamente.">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div>
              <p className="mb-1.5 text-sm font-medium">Portada</p>
              <ImageUpload
                name="coverKey"
                kind="cover"
                initialUrl={values.coverImageUrl}
                seed={values.slug + "cover"}
                label="Portada"
                className="aspect-[16/9] w-full rounded-xl"
              />
              <p className="mt-1 px-1 text-xs text-muted">
                Es la primera imagen de la carta (presentación del local) y el fondo de las categorías sin fotos.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Logo</p>
              <ImageUpload
                name="logoKey"
                kind="logo"
                initialUrl={values.logoUrl}
                seed={values.slug}
                fade="none"
                label="Logo"
                className="aspect-square w-full rounded-xl"
              />
              <p className="mt-1 px-1 text-xs text-muted">También es el ícono de la pestaña del navegador.</p>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium">Imagen para compartir</p>
            <p className="mb-3 text-xs text-muted">
              La que aparece al mandar el enlace de la carta por WhatsApp, Instagram o Facebook. Ideal: horizontal (1200×630).
              Si no subís ninguna, se usa la portada; si tampoco hay, el logo.
            </p>
            <div className="max-w-md">
              <ImageUpload
                name="shareKey"
                kind="share"
                initialUrl={values.shareImageUrl}
                seed={values.slug + "share"}
                fade="none"
                label="Imagen para compartir"
                className="aspect-[1200/630] w-full rounded-xl"
              />
            </div>
          </div>
        </Section>

        <Section title="Redes y enlaces" description="Botones de la portada. Dejá vacío lo que no uses.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram" htmlFor="instagramUrl" error={fe.instagramUrl}>
              <Input id="instagramUrl" name="instagramUrl" type="url" placeholder="https://instagram.com/…" defaultValue={values.instagramUrl ?? ""} />
            </Field>
            <Field label="Facebook" htmlFor="facebookUrl" error={fe.facebookUrl}>
              <Input id="facebookUrl" name="facebookUrl" type="url" placeholder="https://facebook.com/…" defaultValue={values.facebookUrl ?? ""} />
            </Field>
            <Field label="Web" htmlFor="websiteUrl" error={fe.websiteUrl}>
              <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://…" defaultValue={values.websiteUrl ?? ""} />
            </Field>
            <Field
              label="Reseñas de Google"
              htmlFor="googleReviewUrl"
              hint="Se ofrece al comensal después de pedir"
              error={fe.googleReviewUrl}
            >
              <Input id="googleReviewUrl" name="googleReviewUrl" type="url" placeholder="https://g.page/r/…/review" defaultValue={values.googleReviewUrl ?? ""} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="space-y-6 lg:sticky lg:top-8">
        <Section title="Apariencia de la carta" description="El comensal siempre puede cambiarlo desde la carta.">
          <fieldset className="space-y-2">
            <legend className="sr-only">Tema por defecto</legend>
            {THEMES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input type="radio" name="menuTheme" value={t.value} defaultChecked={values.menuTheme === t.value} className="sr-only" />
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-black ring-1 ring-line", t.preview)}>Aa</span>
                <span>
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="block text-xs text-muted">{t.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Section>

        <Section title="Cocina y barra" description="Adónde llegan los pedidos para preparar.">
          <fieldset className="space-y-2">
            <legend className="sr-only">Pantallas de preparación</legend>
            {(
              [
                { value: "SEPARATE", label: "Cocina y barra separadas", hint: "Cada pantalla recibe lo suyo: comidas a cocina, bebidas a barra" },
                { value: "SINGLE", label: "Una sola pantalla", hint: "Todo (comidas y bebidas) llega a Cocina. Para locales sin barra aparte" },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input type="radio" name="prepMode" value={o.value} defaultChecked={values.prepMode === o.value} className="mt-1 accent-[var(--brand)]" />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="mt-2 text-xs text-muted">No hace falta tocar los productos: si un día separan la barra, se cambia acá y listo.</p>
        </Section>

        <Card className="space-y-3 p-4">
          <p className="text-sm text-muted">
            Dirección pública: <span className="font-medium text-ink">/{values.slug}</span>
          </p>
          <FormError message={state?.error} />
          <FormSuccess message={state?.ok} />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </Card>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-sm text-muted">{description}</p>}
      {children}
    </Card>
  );
}
