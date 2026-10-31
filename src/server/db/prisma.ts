// Ruta destino: src/server/db/prisma.ts
//
// Cliente ÚNICO de Prisma. Siempre importa `prisma` desde aquí:
//   import { prisma } from "@/server/db/prisma";
//
// En desarrollo, Next.js recarga los módulos al guardar y, sin este truco,
// se crearían decenas de conexiones a la base de datos. Guardamos la
// instancia en `globalThis` para reutilizarla.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
