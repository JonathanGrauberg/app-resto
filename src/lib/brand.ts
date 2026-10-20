/**
 * Marca de la aplicación: TODO lo que dice el nombre del producto sale de acá.
 * Para cambiar el nombre, editá este archivo; para el logo, `src/components/brand-mark.tsx`;
 * para los colores, el bloque "MARCA" de `src/app/globals.css` (--brand, --brand-ink, --brand-soft).
 */
export const BRAND = {
  /** Nombre del producto (provisorio hasta definir la marca). */
  name: "app-resto",
  /** Frase corta bajo el nombre (login, portada). */
  tagline: "Acceso para restaurantes y personal",
  /** Descripción para buscadores y al compartir el enlace. */
  description: "Carta QR, pedidos, sala, cocina, caja, reservas y métricas para restaurantes.",
  /** Cómo se llama el equipo dueño de la plataforma en el panel interno. */
  team: "Equipo app-resto",
  /** Remitente por defecto de los emails (si no se configura EMAIL_FROM). */
  emailFromName: "Reservas",
} as const;
