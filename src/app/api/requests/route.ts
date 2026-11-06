// Ruta destino: src/app/api/requests/route.ts
//
// POST /api/requests
// Body: { "club": "club-fenix", "provider": "DEEZER", "providerTrackId": "123456" }
//
// El cliente NO envía título ni artista: el servidor los consulta al proveedor.

import { after } from "next/server";
import { ActivityType } from "@prisma/client";
import { lookupTrack, TrackNotFoundError } from "@/server/music/lookup";
import { ProviderError } from "@/server/music/types";
import { badRequest, json, tooManyRequests } from "@/server/http";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";
import { getVoter } from "@/server/security/voter";
import { logActivity } from "@/server/services/activity";
import { submitSongRequest } from "@/server/services/requests";
import { getMusicSiteBySlug } from "@/server/services/sites";
import { createRequestSchema } from "@/lib/validators";

// IP alta (una discoteca entera comparte Wi-Fi); el límite real es por votante
const IP_LIMIT_PER_MIN = 600;
const VOTER_LIMIT = 8; // pedidos (o sumas) por votante...
const VOTER_WINDOW_MS = 10 * 60_000; // ...cada 10 minutos

export async function POST(request: Request) {
  // 1) Límites
  const ipLimit = rateLimit(`requests:ip:${getClientIp(request)}`, IP_LIMIT_PER_MIN, 60_000);
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);

  const { voterHash } = await getVoter();
  const voterLimit = rateLimit(`requests:voter:${voterHash}`, VOTER_LIMIT, VOTER_WINDOW_MS);
  if (!voterLimit.ok) {
    return tooManyRequests(
      voterLimit.retryAfterSec,
      "Has pedido muchas canciones seguidas. Espera un momento antes de pedir otra.",
    );
  }

  // 2) Validar el cuerpo
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("El cuerpo de la petición debe ser JSON válido");
  }
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Parámetros no válidos");
  }
  const { club, provider, providerTrackId } = parsed.data;

  // 3) El club debe existir y tener el módulo de música
  const site = await getMusicSiteBySlug(club);
  if (!site) {
    return json({ error: "Este club no existe o no tiene peticiones de música activas." }, 404);
  }

  // 4) Pedir la canción
  try {
    const result = await submitSongRequest(
      { siteId: site.id, voterHash, provider, providerTrackId },
      () => lookupTrack(provider, providerTrackId),
    );

    if (result.status === "recently_played") {
      return json(
        {
          error: `Esta canción sonó hace poco. Podrás pedirla de nuevo en ~${result.retryAfterMin} min.`,
          code: "recently_played",
          retryAfterMin: result.retryAfterMin,
        },
        409,
      );
    }
    if (result.status === "conflict") {
      return json(
        { error: "La canción cambió de estado justo ahora. Intenta de nuevo.", code: "conflict" },
        409,
      );
    }

    // Registro de actividad DESPUÉS de responder
    after(() =>
      logActivity({
        siteId: site.id,
        voterHash,
        type: result.status === "created" ? ActivityType.REQUEST : ActivityType.VOTE,
        metadata: {
          requestId: result.request.id,
          title: result.request.title,
          artist: result.request.artist,
          provider,
          outcome: result.status,
        },
      }),
    );

    return json(
      { status: result.status, request: result.request, myVote: result.myVote },
      result.status === "created" ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof TrackNotFoundError) {
      return json({ error: "Esa canción ya no está disponible. Busca otra." }, 404);
    }
    if (error instanceof ProviderError) {
      return json(
        { error: "No pudimos verificar la canción ahora mismo. Intenta en un momento." },
        503,
        { "Retry-After": "30" },
      );
    }
    console.error("[api/requests] Error inesperado:", error);
    return json({ error: "Ocurrió un error inesperado." }, 500);
  }
}