// Ruta destino: src/server/music/deezer.ts
//
// Proveedor PRINCIPAL. La búsqueda pública de Deezer no necesita clave.
// Cuota: ~50 peticiones cada 5 segundos por IP (la IP es la de TU servidor).
// Importante: Deezer responde HTTP 200 incluso en errores, con un objeto
// { error: { code, message } }. El código 4 significa "cuota excedida".

import { ProviderError, type MusicProvider, type MusicTrack } from "./types";

const BASE_URL = "https://api.deezer.com/search";
const TIMEOUT_MS = 4000;

type DeezerTrack = {
  id?: number;
  title?: string;
  duration?: number;
  explicit_lyrics?: boolean;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string; cover?: string };
};

type DeezerResponse = {
  data?: DeezerTrack[];
  error?: { type?: string; message?: string; code?: number };
};

export const deezerProvider: MusicProvider = {
  name: "DEEZER",

  async search(query, limit) {
    const url = new URL(BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new ProviderError("DEEZER", "unavailable", "No se pudo conectar con Deezer");
    }

    if (response.status === 429) {
      throw new ProviderError("DEEZER", "quota", "Deezer: demasiadas peticiones (429)");
    }
    if (!response.ok) {
      throw new ProviderError("DEEZER", "unavailable", `Deezer respondió ${response.status}`);
    }

    let body: DeezerResponse;
    try {
      body = (await response.json()) as DeezerResponse;
    } catch {
      throw new ProviderError("DEEZER", "bad_response", "Deezer devolvió una respuesta no válida");
    }

    if (body.error) {
      if (body.error.code === 4) {
        throw new ProviderError("DEEZER", "quota", "Deezer: cuota excedida (código 4)");
      }
      throw new ProviderError(
        "DEEZER",
        "unavailable",
        body.error.message ?? "Deezer devolvió un error",
      );
    }

    if (!Array.isArray(body.data)) {
      throw new ProviderError("DEEZER", "bad_response", "Deezer no devolvió una lista de canciones");
    }

    const tracks: MusicTrack[] = [];
    for (const item of body.data) {
      if (!item.id || !item.title || !item.artist?.name) continue;
      tracks.push({
        provider: "DEEZER",
        providerTrackId: String(item.id),
        title: item.title,
        artist: item.artist.name,
        album: item.album?.title ?? null,
        coverUrl: item.album?.cover_medium ?? item.album?.cover ?? null,
        durationSec: typeof item.duration === "number" ? item.duration : null,
        explicit: item.explicit_lyrics === true,
      });
    }
    return tracks;
  },
};
