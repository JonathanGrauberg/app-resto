/** Slugs que no puede usar un restaurante porque chocan con rutas de la app. */
export const RESERVED_SLUGS = new Set([
  "admin", "staff", "platform", "login", "logout", "api", "app", "_next",
  "registro", "precios", "ayuda", "legal", "privacidad", "cookies", "static",
]);

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
