/**
 * Página de enlaces del local (tipo Linktree, hecha con Yatay): lo primero que se ve al escanear
 * el QR de la mesa, con la carta y las redes. Se configura en Admin → Enlaces.
 * Sin servidor: lo usan la página pública y el formulario del panel.
 */

export type LinkType = "carta" | "reservas" | "instagram" | "whatsapp" | "reviews" | "maps" | "facebook" | "website" | "custom";

export type LinkItem = {
  type: LinkType;
  enabled: boolean;
  /** Usuario, número, dirección o enlace, según el tipo. */
  value?: string;
  /** Texto del botón (los propios; en los fijos, opcional para cambiarlo). */
  label?: string;
};

export const LINK_TYPES: Record<Exclude<LinkType, "custom">, { label: string; placeholder?: string; hint?: string }> = {
  carta: { label: "Ver la carta" },
  reservas: { label: "Reservar mesa" },
  instagram: { label: "Instagram", placeholder: "@usuario o enlace" },
  whatsapp: { label: "WhatsApp", placeholder: "343 611-2205", hint: "El número con característica, sin 0 ni 15" },
  reviews: { label: "Dejanos tu reseña", placeholder: "https://g.page/r/…", hint: "En Google: tu perfil → Pedir reseñas → copiar enlace" },
  maps: { label: "Cómo llegar", placeholder: "Dirección o enlace de Google Maps" },
  facebook: { label: "Facebook", placeholder: "Enlace de la página" },
  website: { label: "Sitio web", placeholder: "https://…" },
};

export const FIXED_TYPES = Object.keys(LINK_TYPES) as Exclude<LinkType, "custom">[];
export const MAX_CUSTOM = 6;

/** Fondos para elegir. "cover" usa la portada del local, oscurecida. */
export const LINK_THEMES = {
  dark: { label: "Noche", bg: "#0b0a09", fg: "#f5f2ed", muted: "rgba(245,242,237,0.65)", button: "rgba(255,255,255,0.08)", buttonFg: "#f5f2ed", ring: "rgba(255,255,255,0.12)" },
  green: { label: "Verde", bg: "#1f4038", fg: "#f3ead9", muted: "rgba(243,234,217,0.7)", button: "rgba(243,234,217,0.1)", buttonFg: "#f3ead9", ring: "rgba(243,234,217,0.18)" },
  cream: { label: "Crema", bg: "#f3ead9", fg: "#1f3a33", muted: "rgba(31,58,51,0.65)", button: "#ffffff", buttonFg: "#1f3a33", ring: "rgba(31,58,51,0.12)" },
  sand: { label: "Arena", bg: "#e6d5bb", fg: "#3b2a1a", muted: "rgba(59,42,26,0.65)", button: "rgba(255,255,255,0.55)", buttonFg: "#3b2a1a", ring: "rgba(59,42,26,0.14)" },
  cover: { label: "Portada", bg: "#0b0a09", fg: "#ffffff", muted: "rgba(255,255,255,0.75)", button: "rgba(0,0,0,0.35)", buttonFg: "#ffffff", ring: "rgba(255,255,255,0.22)" },
} as const;
export type LinkTheme = keyof typeof LINK_THEMES;
export const isLinkTheme = (v: string): v is LinkTheme => v in LINK_THEMES;

type Settings = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  websiteUrl?: string | null;
  googleReviewUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  links?: unknown;
} | null;

/** Lo guardado, completado con los tipos fijos que falten (precargados con los datos del local). */
export function readLinks(s: Settings): LinkItem[] {
  const saved = Array.isArray(s?.links) ? (s!.links as LinkItem[]).filter((l) => l && typeof l.type === "string") : [];
  const defaults: Record<string, string | null | undefined> = {
    instagram: s?.instagramUrl,
    whatsapp: s?.phone,
    reviews: s?.googleReviewUrl,
    maps: s?.address,
    facebook: s?.facebookUrl,
    website: s?.websiteUrl,
  };
  const out = [...saved];
  for (const t of FIXED_TYPES) {
    if (out.some((l) => l.type === t)) continue;
    const value = defaults[t] ?? undefined;
    out.push({ type: t, enabled: t === "carta" || !!value, value: value ?? undefined });
  }
  return out;
}

const withHttps = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

/** Enlace de cada botón (null = no se puede armar, el botón no se muestra). */
export function linkHref(l: LinkItem, ctx: { cartaHref: string; bookingHref: string | null; country: string }): string | null {
  const v = (l.value ?? "").trim();
  switch (l.type) {
    case "carta":
      return ctx.cartaHref;
    case "reservas":
      return ctx.bookingHref;
    case "instagram":
      if (!v) return null;
      return /instagram\.com|^https?:/i.test(v) ? withHttps(v) : `https://instagram.com/${v.replace(/^@/, "")}`;
    case "whatsapp": {
      let d = v.replace(/\D/g, "");
      if (!d) return null;
      // Argentina: para WhatsApp los celulares van con 549 + característica + número (sin 0 ni 15).
      if (ctx.country === "AR" && !d.startsWith("54")) d = `549${d.replace(/^0/, "")}`;
      if (ctx.country === "ES" && !d.startsWith("34")) d = `34${d}`;
      return `https://wa.me/${d}`;
    }
    case "maps":
      if (!v) return null;
      return /^https?:/i.test(v) ? v : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    case "reviews":
    case "facebook":
    case "website":
    case "custom":
      return v ? withHttps(v) : null;
  }
}

export const linkLabel = (l: LinkItem) => (l.label?.trim() || (l.type === "custom" ? "Enlace" : LINK_TYPES[l.type].label));
