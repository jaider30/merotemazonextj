// Ruta destino: src/app/api/search/route.ts
//
// GET /api/search?q=gasolina&club=club-fenix
// El endpoint solo recibe, valida y responde. La lógica vive en los servicios.

import { after, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import { searchTracks } from "@/server/music/search";
import { AllProvidersFailedError } from "@/server/music/types";
import { getClientIp, rateLimit } from "@/server/security/rate-limit";
import { logActivity } from "@/server/services/activity";
import { getMusicSiteBySlug } from "@/server/services/sites";
import { searchQuerySchema } from "@/lib/validators";

// Límite por IP. Es ALTO a propósito: en una discoteca cientos de personas
// comparten la misma Wi-Fi (misma IP pública). Más adelante se combina con
// la cookie del votante para limitar por persona.
const IP_LIMIT = 600;
const IP_WINDOW_MS = 60_000;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  // 1) Límite de peticiones por IP
  const ip = getClientIp(request);
  const limit = rateLimit(`search:${ip}`, IP_LIMIT, IP_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas. Intenta de nuevo en unos segundos." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  // 2) Validar parámetros
  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    club: searchParams.get("club") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Parámetros no válidos" },
      { status: 400, headers: NO_STORE },
    );
  }
  const { q, club } = parsed.data;

  // 3) El club debe existir, estar activo y tener el módulo de música
  const site = await getMusicSiteBySlug(club);
  if (!site) {
    return NextResponse.json(
      { error: "Este club no existe o no tiene peticiones de música activas." },
      { status: 404, headers: NO_STORE },
    );
  }

  // 4) Buscar (caché → Deezer → iTunes)
  try {
    const result = await searchTracks(q);

    // Registrar la búsqueda DESPUÉS de responder, sin retrasar al usuario
    after(() =>
      logActivity({
        siteId: site.id,
        type: ActivityType.SEARCH,
        metadata: {
          query: q.toLowerCase(),
          provider: result.provider,
          cached: result.cached,
          results: result.tracks.length,
        },
      }),
    );

    return NextResponse.json(
      { tracks: result.tracks, provider: result.provider, cached: result.cached },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof AllProvidersFailedError) {
      return NextResponse.json(
        { error: "El buscador de música no está disponible ahora mismo. Intenta en un momento." },
        { status: 503, headers: { ...NO_STORE, "Retry-After": "30" } },
      );
    }
    console.error("[api/search] Error inesperado:", error);
    return NextResponse.json(
      { error: "Ocurrió un error inesperado." },
      { status: 500, headers: NO_STORE },
    );
  }
}
