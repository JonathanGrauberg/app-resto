import { z } from "zod";
import { DEFAULT_REGION, parseMoney, type Region } from "@/lib/region";

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

/** Precio escrito por humanos en la moneda del local ("9,50" € · "12.500" $) → centésimos. */
export const priceInput = (region: Pick<Region, "currency"> = DEFAULT_REGION) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cents = parseMoney(v, region);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: region.currency === "EUR" ? "Precio no válido (ej. 9,50)" : "Precio no válido (ej. 12.500)" });
        return z.NEVER;
      }
      return cents;
    });

/** Checkbox de formulario → boolean. Desmarcado no viaja en el formulario: el campo es opcional. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");
