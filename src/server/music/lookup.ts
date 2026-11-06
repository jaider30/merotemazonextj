// Ruta destino: src/server/music/lookup.ts
//
// Consulta UNA canción por su ID en el proveedor al que pertenece.
// Se usa al crear una petición: el cliente solo manda (provider, id) y el
// servidor obtiene título, artista y portada reales, para que nadie pueda
// inventar textos en la cola del DJ.
//
// Comparte con search.ts el mismo "presupuesto" por proveedor
// (clave "provider:DEEZER" / "provider:ITUNES"), así no se supera la cuota.
// Nota: la lógica de mapeo se parece a la de deezer.ts / itunes.ts; más
// adelante se puede unificar dentro de cada proveedor.

import { rateLimit } from "@/server/security/rate-limit";
import { TtlCache } from "./cache";
import { ProviderError, type MusicProviderName, type MusicTrack } from "./types";

export class TrackNotFoundError extends Error {
  constructor() {
    super("La canción no existe o ya no está disponible");
    this.name = "TrackNotFoundError";
  }
}

const TIMEOUT_MS = 4000;
const COUNTRY = process.env.MUSIC_COUNTRY ?? "CO";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Mismos presupuestos por minuto que en search.ts
const BUDGET_PER_MINUTE: Partial<Record<MusicProviderName, number>> = {
  DEEZER: 300,
  ITUNES: 15,
};

const globalForLookup = globalThis as unknown as {
  __trackLookupCache?: TtlCache<MusicTrack>;
};
const cache = (globalForLookup.__trackLookupCache ??= new TtlCache<MusicTrack>(CACHE_TTL_MS, 2000));

export async function lookupTrack(
  provider: MusicProviderName,
  providerTrackId: string,
): Promise<MusicTrack> {
  const { value } = await cache.getOrLoad(`${provider}:${providerTrackId}`, async () => {
    const budget = BUDGET_PER_MINUTE[provider];
    if (!budget) {
      throw new ProviderError(provider, "unavailable", "Proveedor no soportado");
    }
    if (!rateLimit(`provider:${provider}`, budget, 60_000).ok) {
      throw new ProviderError(provider, "quota", "Presupuesto de llamadas agotado");
    }
    return provider === "DEEZER"
      ? lookupDeezer(providerTrackId)
      : lookupItunes(providerTrackId);
  });
  return value;
}

// ------------------------------- Deezer -------------------------------

type DeezerTrackResponse = {
  id?: number;
  title?: string;
  duration?: number;
  explicit_lyrics?: boolean;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string; cover?: string };
  error?: { code?: number; message?: string };
};

async function lookupDeezer(id: string): Promise<MusicTrack> {
  let response: Response;
  try {
    response = await fetch(`https://api.deezer.com/track/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError("DEEZER", "unavailable", "No se pudo conectar con Deezer");
  }

  if (response.status === 429) {
    throw new ProviderError("DEEZER", "quota", "Deezer: demasiadas peticiones (429)");
  }
  if (!response.ok) {
    throw new ProviderError("DEEZER", "unavailable", `Deezer respondió ${response.status}`);
  }

  let body: DeezerTrackResponse;
  try {
    body = (await response.json()) as DeezerTrackResponse;
  } catch {
    throw new ProviderError("DEEZER", "bad_response", "Deezer devolvió una respuesta no válida");
  }

  if (body.error) {
    if (body.error.code === 4) {
      throw new ProviderError("DEEZER", "quota", "Deezer: cuota excedida (código 4)");
    }
    if (body.error.code === 800) throw new TrackNotFoundError(); // "no data"
    throw new ProviderError("DEEZER", "unavailable", body.error.message ?? "Error de Deezer");
  }

  if (!body.id || !body.title || !body.artist?.name) throw new TrackNotFoundError();

  return {
    provider: "DEEZER",
    providerTrackId: String(body.id),
    title: body.title,
    artist: body.artist.name,
    album: body.album?.title ?? null,
    coverUrl: body.album?.cover_medium ?? body.album?.cover ?? null,
    durationSec: typeof body.duration === "number" ? body.duration : null,
    explicit: body.explicit_lyrics === true,
  };
}

// ------------------------------- iTunes -------------------------------

type ItunesLookupResponse = {
  results?: {
    kind?: string;
    trackId?: number;
    trackName?: string;
    artistName?: string;
    collectionName?: string;
    artworkUrl100?: string;
    trackTimeMillis?: number;
    trackExplicitness?: string;
  }[];
};

async function lookupItunes(id: string): Promise<MusicTrack> {
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", id);
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", COUNTRY);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ProviderError("ITUNES", "unavailable", "No se pudo conectar con iTunes");
  }

  if (response.status === 403 || response.status === 429) {
    throw new ProviderError("ITUNES", "quota", `iTunes limitó las peticiones (${response.status})`);
  }
  if (!response.ok) {
    throw new ProviderError("ITUNES", "unavailable", `iTunes respondió ${response.status}`);
  }

  let body: ItunesLookupResponse;
  try {
    body = (await response.json()) as ItunesLookupResponse;
  } catch {
    throw new ProviderError("ITUNES", "bad_response", "iTunes devolvió una respuesta no válida");
  }

  const item = body.results?.find((r) => r.kind === "song" && String(r.trackId) === id);
  if (!item || !item.trackName || !item.artistName) throw new TrackNotFoundError();

  return {
    provider: "ITUNES",
    providerTrackId: id,
    title: item.trackName,
    artist: item.artistName,
    album: item.collectionName ?? null,
    coverUrl: item.artworkUrl100
      ? item.artworkUrl100.replace(/\/\d+x\d+bb\./, "/300x300bb.")
      : null,
    durationSec:
      typeof item.trackTimeMillis === "number" ? Math.round(item.trackTimeMillis / 1000) : null,
    explicit: item.trackExplicitness === "explicit",
  };
}