/**
 * Marca de la aplicación: TODO lo que dice el nombre del producto sale de acá.
 * Para cambiar el nombre, editá este archivo; para el logo, `src/components/brand-mark.tsx`;
 * para los colores, el bloque "MARCA YATAY" de `src/app/globals.css` (--brand, --brand-ink, --brand-soft).
 * Logos originales: `public/images/`; versiones livianas e íconos: `public/brand/` y `src/app/icon.png`.
 */
export const BRAND = {
  /** Nombre del producto: el yatay, la palmera de Entre Ríos. */
  name: "Yatay",
  /** Bajada del logo. */
  slogan: "Gestión gastronómica",
  /** Verde del logo (íconos, color de la barra del celular, app instalada). */
  color: "#009375",
  /** Frase corta bajo el nombre (login, portada). */
  tagline: "Acceso para restaurantes y personal",
  /** Descripción para buscadores y al compartir el enlace. */
  description: "Carta QR, pedidos, sala, cocina, caja, reservas y métricas para restaurantes, bares, cafeterías y heladerías.",
  /** Cómo se llama el equipo dueño de la plataforma en el panel interno. */
  team: "Equipo Yatay",
  /** Dominio público del producto. */
  domain: "yatay.app",
  /** Remitente por defecto de los emails (si no se configura EMAIL_FROM). */
  emailFromName: "Reservas",
} as const;

/**
 * Chamullame: la app social (pantalla gigante, chat de mesa, chamullos entre mesas) que se suma a Yatay
 * o se contrata sola (boliches, eventos, casamientos). En el código es el módulo MURO.
 */
export const CHAMULLAME = {
  name: "Chamullame",
  tagline: "Lo que pasa entre mesas",
  /** Su página propia (hasta tener dominio). */
  path: "/chamullame",
} as const;
