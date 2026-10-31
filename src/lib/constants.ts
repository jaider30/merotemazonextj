// Ruta destino: src/lib/constants.ts

// Slugs que NO pueden usarse como nombre de club porque chocarían
// con rutas de la aplicación o con palabras del sistema.
export const RESERVED_SLUGS = [
  "admin",
  "dashboard",
  "login",
  "logout",
  "register",
  "signup",
  "api",
  "_next",
  "static",
  "public",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "about",
  "pricing",
  "contact",
  "help",
  "support",
  "terms",
  "privacy",
  "app",
  "www",
  "merotemazo",
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

// Solo minúsculas, números y guiones simples (ej: "club-fenix", "la-terraza-2")
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_REGEX.test(slug);
}
