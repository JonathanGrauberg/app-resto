/**
 * Adaptación por país: moneda, formato, zona horaria, medios de pago y textos legales.
 * Isomórfico (servidor y cliente). Los importes se guardan siempre en centésimos (céntimos / centavos).
 */

export type CountryCode = "ES" | "AR";
export type PayMethod = "CASH" | "CARD" | "BIZUM" | "MERCADOPAGO" | "TRANSFER" | "OTHER";

export type Region = {
  country: CountryCode;
  currency: string;
  locale: string;
  timezone: string;
};

export const COUNTRIES: Record<
  CountryCode,
  {
    label: string;
    currency: string;
    locale: string;
    timezone: string;
    /** Nota de impuestos en ticket y cobro. */
    taxNote: string;
    /** Ayuda del campo precio en la carta. */
    priceHint: string;
    /** Medios de pago que se ofrecen en caja, en orden. */
    payments: PayMethod[];
    /** Texto de la sección de alérgenos al cargar un plato. */
    allergenNote: string;
    /** Zonas horarias ofrecidas (la primera es la habitual). */
    timezones: { id: string; label: string }[];
  }
> = {
  ES: {
    label: "España",
    currency: "EUR",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    taxNote: "IVA incluido",
    priceHint: "IVA incluido. Ej.: 9,50",
    payments: ["CASH", "CARD", "BIZUM", "OTHER"],
    allergenNote: "Obligatorio informar los 14 alérgenos del Reglamento UE 1169/2011 (también en bebidas).",
    timezones: [
      { id: "Europe/Madrid", label: "Península y Baleares" },
      { id: "Atlantic/Canary", label: "Canarias" },
    ],
  },
  AR: {
    label: "Argentina",
    currency: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    taxNote: "Precios finales, impuestos incluidos",
    priceHint: "Precio final al público. Ej.: 12.500",
    payments: ["CASH", "CARD", "MERCADOPAGO", "TRANSFER", "OTHER"],
    allergenNote: "Indicá los alérgenos del plato. Para celíacos: si lleva TACC, marcá «Gluten».",
    timezones: [{ id: "America/Argentina/Buenos_Aires", label: "Argentina (UTC−3)" }],
  },
};

export const DEFAULT_REGION: Region = { country: "ES", currency: "EUR", locale: "es-ES", timezone: "Europe/Madrid" };

export const isCountry = (v: string): v is CountryCode => v in COUNTRIES;

/** Región de un local a partir de sus ajustes (con valores por defecto si faltan). */
export function regionOf(s: { country?: string | null; currency?: string | null; locale?: string | null; timezone?: string | null } | null | undefined): Region {
  const country = s?.country && isCountry(s.country) ? s.country : "ES";
  const c = COUNTRIES[country];
  return {
    country,
    currency: s?.currency || c.currency,
    locale: s?.locale || c.locale,
    timezone: s?.timezone || c.timezone,
  };
}

/** Lo que se guarda en los ajustes del local al elegir país (y zona horaria, si hay varias). */
export function regionSettingsFor(country: CountryCode, timezone?: string | null) {
  const c = COUNTRIES[country];
  const tz = c.timezones.some((t) => t.id === timezone) ? timezone! : c.timezones[0].id;
  return { country, currency: c.currency, locale: c.locale, timezone: tz };
}

export const PAY_LABEL: Record<PayMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  BIZUM: "Bizum",
  MERCADOPAGO: "Mercado Pago",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

// ─────────────────────────────────────────────────────────────
// Dinero
// ─────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(r: Pick<Region, "currency" | "locale">, decimals: boolean) {
  const key = `${r.locale}|${r.currency}|${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(r.locale, {
      style: "currency",
      currency: r.currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Monedas que se usan sin centavos en la práctica (precios redondos): solo muestran decimales si los hay. */
const ROUND_CURRENCIES = new Set(["ARS", "CLP", "COP", "PYG", "UYU"]);

/** 1250 → "12,50 €" (EUR) · 1250000 → "$ 12.500" (ARS). */
export function formatMoney(cents: number, r: Pick<Region, "currency" | "locale"> = DEFAULT_REGION) {
  const decimals = !ROUND_CURRENCIES.has(r.currency) || cents % 100 !== 0;
  return formatter(r, decimals).format(cents / 100);
}

/** Símbolo de la moneda ("€", "$"). */
export function currencySymbol(r: Pick<Region, "currency" | "locale"> = DEFAULT_REGION) {
  return formatter(r, false).formatToParts(0).find((p) => p.type === "currency")?.value ?? r.currency;
}

/**
 * Lo que escribe una persona → centésimos, o null si no es un importe.
 * Euro: "9,50" / "9.50" / "10". Peso: "12.500" (punto de miles) / "12500" / "12.500,50".
 * Si aparecen punto y coma, el último es el decimal.
 */
export function parseMoney(text: string, r: Pick<Region, "currency"> = DEFAULT_REGION): number | null {
  let s = String(text ?? "").replace(/[\s€$]|ARS|EUR/gi, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Los dos: el último es el decimal, el otro es separador de miles.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  } else if (lastDot >= 0 && ROUND_CURRENCIES.has(r.currency) && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "12.500" en pesos son doce mil quinientos, no doce con cincuenta.
    s = s.replace(/\./g, "");
  }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Centésimos → texto editable en un campo ("9,50" · "12500"). */
export function moneyInputValue(cents: number, r: Pick<Region, "currency"> = DEFAULT_REGION) {
  if (ROUND_CURRENCIES.has(r.currency) && cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2).replace(".", ",");
}
