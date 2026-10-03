import { Coffee, ImageIcon, UtensilsCrossed, Wine } from "lucide-react";
import { cn } from "@/lib/format";

const icons = { kitchen: UtensilsCrossed, bar: Wine, coffee: Coffee, generic: ImageIcon };

export type Fade = "none" | "bottom" | "left" | "right" | "hero" | "card";

/**
 * Degradado hacia el color de fondo (negro en oscuro, blanco en claro).
 * Unifica fotos de calidad dispareja y da el acabado "premium".
 * Se usa igual sobre fotos reales (ver <FadedImage>) y sobre los mockups.
 */
export function FadeOverlay({ fade, to = "bg" }: { fade: Fade; to?: "bg" | "surface" }) {
  if (fade === "none") return null;
  const from = to === "bg" ? "from-bg" : "from-surface";
  return (
    <>
      {(fade === "bottom" || fade === "hero") && (
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-transparent", from, fade === "hero" ? "via-30%" : "via-40%")} />
      )}
      {fade === "left" && <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent via-45% to-transparent", from)} />}
      {fade === "right" && <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-l via-transparent via-45% to-transparent", from)} />}
      {/* Tarjeta de carta: en celular funde hacia la izquierda (texto al lado); desde tablet, hacia abajo */}
      {fade === "card" && (
        <>
          <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r via-transparent via-50% to-transparent sm:hidden", from)} />
          <div className={cn("pointer-events-none absolute inset-0 hidden bg-gradient-to-t via-transparent via-45% to-transparent sm:block", from)} />
        </>
      )}
      {fade === "hero" && (
        <>
          {/* Lateral (texto a la izquierda en pantallas anchas) */}
          <div className={cn("pointer-events-none absolute inset-0 hidden bg-gradient-to-r via-bg/70 via-35% to-transparent to-70% md:block", from)} />
          {/* Superior suave para la barra del local */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg/70 to-transparent" />
          {/* Velo general en celular, donde el texto va sobre la imagen */}
          <div className="pointer-events-none absolute inset-0 bg-bg/35 md:hidden" />
        </>
      )}
    </>
  );
}

/** Imagen real con el degradado aplicado. */
export function FadedImage({
  src,
  alt,
  fade = "bottom",
  to,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  fade?: Fade;
  to?: "bg" | "surface";
  /** Imágenes de la primera pantalla (portada, logo): cargan de inmediato. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ya vienen comprimidas desde el navegador */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <FadeOverlay fade={fade} to={to} />
    </div>
  );
}

/**
 * Placeholder "fotográfico" mientras no hay subida de imágenes (R2).
 * El tono se deriva del `seed`: cada producto tiene siempre el mismo.
 */
export function MockImage({
  seed,
  kind = "generic",
  label,
  fade = "none",
  to,
  hideIcon = false,
  className,
}: {
  seed: string;
  /** Ocultar el ícono (fondos grandes con texto encima). */
  hideIcon?: boolean;
  kind?: keyof typeof icons;
  label?: string;
  fade?: Fade;
  to?: "bg" | "surface";
  className?: string;
}) {
  const n = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Cocina: cálidos (rojos/ocres/verdes). Bar: ámbar, vino, azul noche.
  const hues = kind === "bar" ? [28, 345, 210, 42] : [14, 32, 48, 95, 8];
  const h = hues[n % hues.length];
  const x = 35 + (n % 40);
  const y = 30 + ((n >> 3) % 40);
  const Icon = icons[kind];

  return (
    <div
      role="img"
      aria-label={label ?? "Imagen de ejemplo"}
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, hsl(${h} 70% 58%) 0%, hsl(${h} 55% 34%) 32%, hsl(${(h + 20) % 360} 35% 14%) 75%, hsl(${h} 20% 8%) 100%)`,
      }}
    >
      {!hideIcon && <Icon
        className="absolute left-1/2 top-1/2 size-1/4 max-h-20 max-w-20 -translate-x-1/2 -translate-y-1/2 text-white/25"
        strokeWidth={1.25}
        aria-hidden
      />}
      <FadeOverlay fade={fade} to={to} />
    </div>
  );
}

/** Foto real si hay URL; si no, el placeholder. Siempre con el mismo degradado. */
export function Photo({
  src,
  seed,
  kind = "kitchen",
  label,
  fade = "none",
  to,
  hideIcon,
  priority,
  className,
}: {
  src?: string | null;
  priority?: boolean;
  seed: string;
  kind?: keyof typeof icons;
  label?: string;
  fade?: Fade;
  to?: "bg" | "surface";
  hideIcon?: boolean;
  className?: string;
}) {
  if (src) return <FadedImage src={src} alt={label ?? ""} fade={fade} to={to} priority={priority} className={className} />;
  return <MockImage seed={seed} kind={kind} label={label} fade={fade} to={to} hideIcon={hideIcon} className={className} />;
}
