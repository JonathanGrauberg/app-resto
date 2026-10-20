import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/format";

/**
 * Logo de la aplicación. Hoy es el nombre en texto; cuando haya logo, se reemplaza acá
 * (por ejemplo, por un <svg> o <Image>) y cambia en toda la app.
 */
export function BrandMark({ className }: { className?: string }) {
  return <span className={cn("font-semibold tracking-tight", className)}>{BRAND.name}</span>;
}
