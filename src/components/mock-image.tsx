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
 * Lugar de la foto mientras el local no subió una: siempre oscuro (en carta clara u oscura),
 * con rayas diagonales finas y "Imagen próximamente". En recuadros chicos, solo un ícono.
 */
export function MockImage({
  kind = "generic",
  label,
  fade = "none",
  to,
  hideIcon = false,
  className,
}: {
  /** Se mantiene por compatibilidad (antes daba el tono del placeholder). */
  seed?: string;
  /** Ocultar el ícono y el texto (fondos grandes con texto encima). */
  hideIcon?: boolean;
  kind?: keyof typeof icons;
  label?: string;
  fade?: Fade;
  to?: "bg" | "surface";
  className?: string;
}) {
  const Icon = icons[kind];
  return (
    <div
      role="img"
      aria-label={label ? `${label} (sin foto)` : "Imagen próximamente"}
      className={cn("@container relative overflow-hidden bg-[#141312]", className)}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 18px)" }}
    >
      {!hideIcon && (
        <>
          <div className="absolute inset-0 hidden place-items-center @[10rem]:grid">
            <span className="flex flex-col items-center gap-2 bg-[#141312]/85 px-4 py-3 text-[10px] font-medium uppercase tracking-[0.35em] text-[#b8a07a]">
              <span className="h-px w-6 bg-[#b8a07a]/60" aria-hidden />
              Imagen próximamente
            </span>
          </div>
          <Icon
            className="absolute left-1/2 top-1/2 size-1/3 max-h-10 max-w-10 -translate-x-1/2 -translate-y-1/2 text-white/20 @[10rem]:hidden"
            strokeWidth={1.25}
            aria-hidden
          />
        </>
      )}
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
