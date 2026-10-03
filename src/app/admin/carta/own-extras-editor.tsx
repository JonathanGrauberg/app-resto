"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { formatPrice } from "@/lib/format";

export type Extra = { name: string; extraPriceCents: number };

/** Precio escrito por humanos ("1,5", "2", "") → céntimos; null si no es válido. */
function parseCents(v: string) {
  const s = v.replace(/\s|€|\+/g, "").replace(",", ".");
  if (s === "") return 0;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/**
 * "Extras de este plato": se escriben, se agregan con + (o Enter) y quedan como chips.
 * Se envían con el formulario del producto en el campo oculto `ownExtras`.
 */
export function OwnExtrasEditor({ initial }: { initial: Extra[] }) {
  const [extras, setExtras] = useState<Extra[]>(initial);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const n = name.trim();
    if (!n) return nameRef.current?.focus();
    const cents = parseCents(price);
    if (cents === null) return setError("Precio no válido (ej. 1,50)");
    if (extras.some((e) => e.name.toLowerCase() === n.toLowerCase())) return setError("Ese extra ya está en la lista");
    if (extras.length >= 20) return setError("Máximo 20 extras");
    setExtras((prev) => [...prev, { name: n.slice(0, 40), extraPriceCents: cents }]);
    setName("");
    setPrice("");
    setError(null);
    nameRef.current?.focus();
  };

  // Enter agrega el extra en lugar de enviar el formulario del producto.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div>
      <input type="hidden" name="ownExtras" value={JSON.stringify(extras)} />

      {extras.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Extras de este plato">
          {extras.map((e, i) => (
            <li
              key={e.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft py-1 pl-3 pr-1 text-sm"
            >
              <span>{e.name}</span>
              {e.extraPriceCents > 0 && <span className="text-muted">+{formatPrice(e.extraPriceCents)}</span>}
              <button
                type="button"
                onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Quitar ${e.name}`}
                className="flex size-6 items-center justify-center rounded-full hover:bg-ink/10"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribí el extra (ej. Doble de queso)"
          aria-label="Nombre del extra"
          maxLength={40}
          className="flex-1"
        />
        <div className="relative w-28 shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">+€</span>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={onKeyDown}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Precio del extra (opcional)"
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={add}
          aria-label="Agregar extra"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink hover:bg-brand/90"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">
          Solo para este plato. Precio opcional: dejalo vacío si es gratis (ej. &ldquo;Sin cebolla&rdquo;).
        </p>
      )}
    </div>
  );
}
