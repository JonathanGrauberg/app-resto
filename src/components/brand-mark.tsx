import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/format";

/**
 * Logo de Yatay. `full` = isotipo + nombre + "Gestión gastronómica"; `icon` = solo la palmera.
 * En oscuro usa la versión blanca. Los archivos salen de `public/brand/` (generados desde `public/images/`).
 * El alto se controla con `className` (por ejemplo `h-10`); el ancho se ajusta solo.
 */
export function BrandMark({ variant = "full", className, priority }: { variant?: "full" | "icon"; className?: string; priority?: boolean }) {
  const [src, srcDark, w, h] =
    variant === "full"
      ? ["/brand/yatay-marca.png", "/brand/yatay-marca-blanco.png", 720, 261]
      : ["/brand/yatay-isotipo.png", "/brand/yatay-isotipo-blanco.png", 256, 256];
  const img = cn("h-full w-auto", variant === "full" ? "max-w-none" : "");
  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center", className)}>
      <Image src={src} alt={BRAND.name} width={w} height={h} priority={priority} className={cn(img, "dark:hidden")} />
      <Image src={srcDark} alt={BRAND.name} width={w} height={h} priority={priority} className={cn(img, "hidden dark:block")} />
    </span>
  );
}
