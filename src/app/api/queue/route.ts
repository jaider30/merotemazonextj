// Ruta destino: src/app/api/queue/route.ts
//
// GET /api/queue?club=club-fenix
// Devuelve la cola ordenada por puntaje (con el voto de ESTE usuario en cada
// canción) y las últimas canciones reproducidas.
//
// Se consulta cada pocos segundos desde el celular, así que:
//  - la parte compartida se cachea 3 s por club (ver services/requests.ts)
//  - el límite por IP es muy alto (toda la discoteca comparte Wi-Fi) y el que
//    manda es el límite por votante.

import { badRequest, json, tooManyRequests } from "@/server/http";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";
import { getVoter } from "@/server/security/voter";
import { listQueue } from "@/server/services/requests";
import { getMusicSiteBySlug } from "@/server/services/sites";
import { queueQuerySchema } from "@/lib/validators";

const IP_LIMIT_PER_MIN = 6000;
const VOTER_LIMIT_PER_MIN = 60; // consultar cada 5 s son ~12/min; hay margen

export async function GET(request: Request) {
  // 1) Límites
  const ipLimit = rateLimit(`queue:ip:${getClientIp(request)}`, IP_LIMIT_PER_MIN, 60_000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const { voterHash } = await getVoter();
  const voterLimit = rateLimit(`queue:voter:${voterHash}`, VOTER_LIMIT_PER_MIN, 60_000);
  if (!voterLimit.ok) return tooManyRequests(voterLimit.retryAfterSec);

  // 2) Validar parámetros
  const { searchParams } = new URL(request.url);
  const parsed = queueQuerySchema.safeParse({ club: searchParams.get("club") ?? "" });
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Parámetros no válidos");
  }

  // 3) El club debe existir y tener el módulo de música
  const site = await getMusicSiteBySlug(parsed.data.club);
  if (!site) {
    return json({ error: "Este club no existe o no tiene peticiones de música activas." }, 404);
  }

  // 4) Cola
  try {
    const { queue, played } = await listQueue(site.id, voterHash);
    return json({ queue, played });
  } catch (error) {
    console.error("[api/queue] Error inesperado:", error);
    return json({ error: "Ocurrió un error inesperado." }, 500);
  }
}