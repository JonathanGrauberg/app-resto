"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { LinksPage } from "@/components/links/links-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, FormSuccess, Input, Switch } from "@/components/ui/field";
import { cn } from "@/lib/format";
import { LINK_THEMES, LINK_TYPES, MAX_CUSTOM, type LinkItem, type LinkTheme } from "@/lib/links";
import { useFormAction } from "@/lib/use-form-action";
import { saveLinks } from "./actions";

type Row = LinkItem & { key: string };
let seq = 0;
const keyed = (l: LinkItem): Row => ({ ...l, key: `l${++seq}` });

/** Configurar la página de enlaces, con la vista previa del celular al lado. */
export function LinksForm({
  initial,
  venue,
  publicUrl,
  hasBooking,
  country,
}: {
  initial: { enabled: boolean; theme: LinkTheme; links: LinkItem[] };
  venue: { name: string; tagline: string | null; logoUrl: string | null; coverImageUrl: string | null };
  publicUrl: string;
  hasBooking: boolean;
  country: string;
}) {
  const [state, action, pending] = useFormAction(saveLinks, undefined);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [theme, setTheme] = useState<LinkTheme>(initial.theme);
  const [rows, setRows] = useState<Row[]>(() => initial.links.map(keyed));
  const [copied, setCopied] = useState(false);

  const update = (key: string, patch: Partial<LinkItem>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const customs = rows.filter((r) => r.type === "custom").length;
  const links: LinkItem[] = rows.map((r) => ({ type: r.type, enabled: r.enabled, value: r.value, label: r.label }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <form onSubmit={action} className="space-y-6">
        <input type="hidden" name="links" value={JSON.stringify(links)} />
        <input type="hidden" name="linksTheme" value={theme} />

        <Card className="space-y-4 p-4 sm:p-5">
          <Switch
            name="linksEnabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            label="Mostrar esta página al escanear el QR de la mesa"
            description="Apagada, el QR abre la carta directo."
          />
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm">
            <span className="text-muted">Para tu Instagram o WhatsApp:</span>
            <code className="truncate">{publicUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(publicUrl).then(() => setCopied(true), () => {});
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand hover:bg-brand-soft"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copiado" : "Copiar"}
            </button>
            {initial.enabled && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand hover:bg-brand-soft">
                <ExternalLink className="size-4" aria-hidden /> Abrir
              </a>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Fondo</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(LINK_THEMES) as LinkTheme[]).map((k) => {
              const t = LINK_THEMES[k];
              const off = k === "cover" && !venue.coverImageUrl;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={off}
                  onClick={() => setTheme(k)}
                  title={off ? "Subí una portada en Ajustes para usarla de fondo" : undefined}
                  aria-pressed={theme === k}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm disabled:opacity-40", theme === k ? "border-brand bg-brand-soft" : "border-line")}
                >
                  <span className="size-4 rounded-full ring-1 ring-ink/15" style={{ background: k === "cover" && venue.coverImageUrl ? `center/cover url(${venue.coverImageUrl})` : t.bg }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold">Botones</h2>
          <p className="text-sm text-muted">Prendé los que quieras y ordenalos con las flechas. &ldquo;Ver la carta&rdquo; es el principal.</p>
          <ul className="mt-4 space-y-3">
            {rows.map((r, i) => {
              const meta = r.type === "custom" ? null : LINK_TYPES[r.type];
              const needsValue = r.type !== "carta" && !(r.type === "reservas" && hasBooking);
              return (
                <li key={r.key} className={cn("rounded-xl border p-3", r.enabled ? "border-line" : "border-line/60 opacity-70")}>
                  <div className="flex items-center gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm font-medium">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.key, { enabled: e.target.checked })} className="size-4 accent-[var(--brand)]" />
                      {meta ? meta.label : "Enlace propio"}
                    </label>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30">
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Bajar" className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30">
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    {r.type === "custom" && (
                      <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label="Quitar" className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  {r.enabled && (
                    <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
                      <Input
                        value={r.label ?? ""}
                        onChange={(e) => update(r.key, { label: e.target.value })}
                        placeholder={meta ? `Texto: ${meta.label}` : "Texto del botón (ej. Nuestras tortas)"}
                        aria-label="Texto del botón"
                        maxLength={40}
                      />
                      {(needsValue || r.type === "custom") && (
                        <Input
                          value={r.value ?? ""}
                          onChange={(e) => update(r.key, { value: e.target.value })}
                          placeholder={meta?.placeholder ?? "https://…"}
                          aria-label="Dirección del enlace"
                          maxLength={300}
                        />
                      )}
                      {meta?.hint && (r.type !== "reservas" || !hasBooking) && <p className="text-xs text-muted sm:col-span-2">{meta.hint}</p>}
                      {r.type === "reservas" && hasBooking && <p className="text-xs text-muted sm:col-span-2">Lleva a tu página de reservas online.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {customs < MAX_CUSTOM && (
            <button type="button" onClick={() => setRows((x) => [...x, keyed({ type: "custom", enabled: true, label: "", value: "" })])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
              <Plus className="size-4" aria-hidden /> Agregar un enlace propio
            </button>
          )}
          <p className="mt-1 text-xs text-muted">Los enlaces propios (tortas, delivery, eventos…) llevan el ícono de Yatay.</p>
        </Card>

        <div className="space-y-3">
          <FormError message={state?.error} />
          <FormSuccess message={state?.ok} />
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>

      {/* Vista previa en un "celular" */}
      <div className="lg:sticky lg:top-8">
        <p className="mb-2 text-sm font-medium text-muted">Así se ve</p>
        <div className="relative mx-auto h-[640px] w-[320px] overflow-hidden rounded-[2.2rem] border-[6px] border-ink/80 shadow-xl [transform:translateZ(0)]">
          <div className="pointer-events-none flex h-full flex-col overflow-y-auto [&>main]:min-h-full" inert>
            <LinksPage venue={venue} links={links} theme={theme} cartaHref="#" bookingHref={hasBooking ? "#" : null} country={country} />
          </div>
        </div>
      </div>
    </div>
  );
}
