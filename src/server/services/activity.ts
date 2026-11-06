// Ruta destino: src/server/services/activity.ts
//
// Registro de actividad para los dashboards (visitas, búsquedas, peticiones,
// votos). Si falla el registro, NUNCA debe romper la acción del usuario:
// por eso captura el error y solo lo muestra en consola.

import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

type LogActivityInput = {
  siteId: string;
  type: ActivityType;
  voterHash?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        siteId: input.siteId,
        type: input.type,
        voterHash: input.voterHash ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[activity] No se pudo registrar la actividad:", error);
  }
}
