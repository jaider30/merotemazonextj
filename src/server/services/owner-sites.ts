// Ruta destino: src/server/services/owner-sites.ts
//
// REGLA DE ORO DEL MULTI-TENANT: el ownerId siempre sale de la SESIÓN
// (requireUser), nunca de la URL ni del cuerpo de una petición. Así un cliente
// no puede pedir los clubes de otro cambiando un parámetro.

import { RequestStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

/** Clubes de UN dueño. Úsalo con el id que viene de la sesión. */
export async function listOwnedSites(ownerId: string) {
  return prisma.site.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      niche: true,
      status: true,
      primaryColor: true,
      _count: { select: { requests: { where: { status: RequestStatus.PENDING } } } },
    },
  });
}

/** TODOS los clubes con su dueño. Solo para el panel de admin (requireAdmin). */
export async function listAllSites() {
  return prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      niche: true,
      status: true,
      owner: { select: { name: true, email: true } },
      _count: { select: { requests: { where: { status: RequestStatus.PENDING } } } },
    },
  });
}