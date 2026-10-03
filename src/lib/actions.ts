import { z } from "zod";

/** Estado estándar que devuelven las Server Actions de formularios. */
export type ActionState =
  | {
      error?: string;
      ok?: string;
      fieldErrors?: Record<string, string>;
      /** Cambia en cada envío exitoso: sirve para resetear/cerrar formularios. */
      at?: number;
    }
  | undefined;

export function fail(error: z.ZodError | string): ActionState {
  if (typeof error === "string") return { error };
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Revisá los campos marcados", fieldErrors };
}

export function success(ok: string): ActionState {
  return { ok, at: Date.now() };
}

// ── Helpers de validación reutilizables ───────────────────────

/** Texto opcional: "" → null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

/** URL opcional: "" → null; si viene, debe ser http(s). */
export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https?:\/\/\S+\.\S+/.test(v), "Debe empezar con https://");

/** Precio en euros escrito por humanos ("9,50", "9.5", "10") → céntimos. */
export const priceInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s|€/g, "").replace(",", "."))
  .refine((v) => /^\d{1,5}(\.\d{1,2})?$/.test(v), "Precio no válido (ej. 9,50)")
  .transform((v) => Math.round(Number(v) * 100));

/** Checkbox de formulario → boolean. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");
