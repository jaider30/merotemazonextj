// Ruta destino: src/server/services/sites.ts
//
// Lógica de acceso a datos de los sitios. Las páginas y los endpoints
// llaman a estas funciones; nunca hablan directo con Prisma.

import { ModuleKey, RequestStatus, SiteStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

/**
 * Carga un sitio público por su slug, con todo lo que necesita su página:
 * módulos, fotos, catálogo, eventos activos y cola de canciones pendientes.
 * Devuelve null si el sitio no existe o está suspendido.
 */
export async function getPublicSiteBySlug(slug: string) {
  return prisma.site.findFirst({
    where: {
      slug: slug.toLowerCase(),
      status: SiteStatus.ACTIVE,
    },
    include: {
      modules: true,
      photos: { orderBy: { position: "asc" } },
      categories: {
        orderBy: { position: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { position: "asc" },
          },
        },
      },
      events: {
        where: { isActive: true },
        orderBy: { startsAt: "asc" },
      },
      requests: {
        where: { status: RequestStatus.PENDING },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: 20,
      },
    },
  });
}

/**
 * Devuelve { id, slug } del sitio SOLO si está activo y tiene el módulo de
 * música habilitado. Lo usan los endpoints de búsqueda, peticiones y votos
 * para rechazar clubes inexistentes, suspendidos o sin ese módulo.
 */
export async function getMusicSiteBySlug(slug: string) {
  return prisma.site.findFirst({
    where: {
      slug: slug.toLowerCase(),
      status: SiteStatus.ACTIVE,
      modules: { some: { module: ModuleKey.MUSIC } },
    },
    select: { id: true, slug: true },
  });
}

/**
 * Datos mínimos para pintar la página de música de un club (cabecera y color).
 * Devuelve null si el sitio no existe, está suspendido o no tiene el módulo.
 */
export async function getMusicPageSite(slug: string) {
  return prisma.site.findFirst({
    where: {
      slug: slug.toLowerCase(),
      status: SiteStatus.ACTIVE,
      modules: { some: { module: ModuleKey.MUSIC } },
    },
    select: { slug: true, name: true, logoUrl: true, primaryColor: true },
  });
}