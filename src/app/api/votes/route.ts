// Ruta destino: src/app/api/votes/route.ts
//
// POST /api/votes
// Body: { "club": "club-fenix", "requestId": "clx...", "value": 1 }   (1 = ▲, -1 = ▼)
// Pulsar la misma flecha otra vez quita tu voto (toggle, como Reddit).

import { after } from "next/server";
import { ActivityType } from "@prisma/client";
import { badRequest, json, tooManyRequests } from "@/server/http";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";
import { getVoter } from "@/server/security/voter";
import { logActivity } from "@/server/services/activity";
import { castVote } from "@/server/services/requests";
import { getMusicSiteBySlug } from "@/server/services/sites";
import { voteSchema } from "@/lib/validators";

const IP_LIMIT_PER_MIN = 600; // alto: una discoteca comparte Wi-Fi
const VOTER_LIMIT_PER_MIN = 40;

export async function POST(request: Request) {
  // 1) Límites
  const ipLimit = rateLimit(`votes:ip:${getClientIp(request)}`, IP_LIMIT_PER_MIN, 60_000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const { voterHash } = await getVoter();
  const voterLimit = rateLimit(`votes:voter:${voterHash}`, VOTER_LIMIT_PER_MIN, 60_000);
  if (!voterLimit.ok) return tooManyRequests(voterLimit.retryAfterSec);

  // 2) Validar el cuerpo
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("El cuerpo de la petición debe ser JSON válido");
  }
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Parámetros no válidos");
  }
  const { club, requestId, value } = parsed.data;

  // 3) El club debe existir y tener el módulo de música
  const site = await getMusicSiteBySlug(club);
  if (!site) {
    return json({ error: "Este club no existe o no tiene peticiones de música activas." }, 404);
  }

  // 4) Votar
  try {
    const outcome = await castVote({
      siteId: site.id,
      requestId,
      voterHash,
      value,
      toggle: true,
    });

    if (!outcome) {
      return json({ error: "Esa canción ya no está en la cola." }, 404);
    }

    after(() =>
      logActivity({
        siteId: site.id,
        voterHash,
        type: ActivityType.VOTE,
        metadata: { requestId, value: outcome.myVote },
      }),
    );

    return json({ request: outcome.request, myVote: outcome.myVote });
  } catch (error) {
    console.error("[api/votes] Error inesperado:", error);
    return json({ error: "Ocurrió un error inesperado." }, 500);
  }
}