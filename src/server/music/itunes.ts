// Ruta destino: src/server/music/itunes.ts
//
// Proveedor de RESPALDO. Apple documenta ~20 llamadas por minuto (aprox. y
// sujeto a cambios), por eso el servicio de búsqueda solo le permite 15/min.
// Solo usamos metadatos y portada. NO usamos los previews de audio: los
// términos de Apple exigen mostrarlos junto a un botón de su tienda.

import { ProviderError, type MusicProvider, type MusicTrack } from "./types";

const BASE_URL = "https://itunes.apple.com/search";
const TIMEOUT_MS = 4000;

// País de la tienda (afecta qué catálogo se consulta). Cámbialo en .env si quieres.
const COUNTRY = process.env.MUSIC_COUNTRY ?? "CO";

type ItunesResult = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackExplicitness?: string; // "explicit" | "cleaned" | "notExplicit"
};

type ItunesResponse = {
  resultCount?: number;
  results?: ItunesResult[];
};

// Apple entrega la portada en 100x100; la URL permite pedir otro tamaño
function upscaleArtwork(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, "/300x300bb.");
}

export const itunesProvider: MusicProvider = {
  name: "ITUNES",

  async search(query, limit) {
    const url = new URL(BASE_URL);
    url.searchParams.set("term", query);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("country", COUNTRY);
    url.searchParams.set("limit", String(limit));

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

    let body: ItunesResponse;
    try {
      body = (await response.json()) as ItunesResponse;
    } catch {
      throw new ProviderError("ITUNES", "bad_response", "iTunes devolvió una respuesta no válida");
    }

    if (!Array.isArray(body.results)) {
      throw new ProviderError("ITUNES", "bad_response", "iTunes no devolvió una lista de canciones");
    }

    const tracks: MusicTrack[] = [];
    for (const item of body.results) {
      if (item.kind !== "song" || !item.trackId || !item.trackName || !item.artistName) continue;
      tracks.push({
        provider: "ITUNES",
        providerTrackId: String(item.trackId),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName ?? null,
        coverUrl: upscaleArtwork(item.artworkUrl100),
        durationSec:
          typeof item.trackTimeMillis === "number" ? Math.round(item.trackTimeMillis / 1000) : null,
        explicit: item.trackExplicitness === "explicit",
      });
    }
    return tracks;
  },
};
