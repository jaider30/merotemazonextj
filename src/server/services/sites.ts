// Ruta destino: src/server/services/sites.ts
//
// Lógica de acceso a datos de los sitios. Las páginas y los endpoints
// llaman a estas funciones; nunca hablan directo con Prisma.

import { RequestStatus, SiteStatus } from "@prisma/client";
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
