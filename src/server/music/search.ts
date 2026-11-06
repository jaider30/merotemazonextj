// Ruta destino: src/server/music/search.ts
//
// Servicio de búsqueda de canciones. Los endpoints llaman SOLO a esta función.
//
// Flujo:  caché (10 min) → Deezer → iTunes → error si ninguno responde.
// Protecciones:
//  - Cada proveedor tiene un presupuesto de llamadas por minuto (iTunes, bajo).
//  - Si un proveedor responde "cuota excedida", se le da una pausa de 30 s.
//  - Peticiones idénticas y simultáneas comparten una sola llamada externa.

import { rateLimit } from "@/server/security/rate-limit";
import { TtlCache } from "./cache";
import { deezerProvider } from "./deezer";
import { itunesProvider } from "./itunes";
import {
  AllProvidersFailedError,
  ProviderError,
  type MusicProvider,
  type MusicProviderName,
  type MusicTrack,
} from "./types";

export type SearchResult = {
  tracks: MusicTrack[];
  provider: MusicProviderName; // qué proveedor respondió
  cached: boolean; // true si salió de la caché
};

type StoredResult = Omit<SearchResult, "cached">;

const SEARCH_LIMIT = 10;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const QUOTA_COOLDOWN_MS = 30 * 1000; // pausa tras error de cuota

// Orden de preferencia + presupuesto de llamadas por minuto de TU servidor
const CHAIN: { provider: MusicProvider; maxPerMinute: number }[] = [
  { provider: deezerProvider, maxPerMinute: 300 }, // Deezer: ~50 cada 5 s
  { provider: itunesProvider, maxPerMinute: 15 }, //  iTunes: ~20 por minuto
];

// Se guardan en globalThis para sobrevivir a las recargas de Next en desarrollo
const globalForMusic = globalThis as unknown as {
  __musicSearchCache?: TtlCache<StoredResult>;
  __musicCooldowns?: Map<string, number>;
};
const cache = (globalForMusic.__musicSearchCache ??= new TtlCache<StoredResult>(CACHE_TTL_MS, 1000));
const cooldownUntil = (globalForMusic.__musicCooldowns ??= new Map<string, number>());

// Misma búsqueda escrita distinto ("  Gasolina ", "gasolina") comparte caché
export function normalizeQuery(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

// Útil para PRUEBAS: MUSIC_DISABLE_PROVIDERS="DEEZER" en .env fuerza el respaldo
function disabledProviders(): Set<string> {
  return new Set(
    (process.env.MUSIC_DISABLE_PROVIDERS ?? "")
      .split(",")
      .map((name) => name.trim().toUpperCase())
      .filter(Boolean),
  );
}

async function searchWithFallback(query: string): Promise<StoredResult> {
  const disabled = disabledProviders();

  for (const { provider, maxPerMinute } of CHAIN) {
    if (disabled.has(provider.name)) continue;
    if ((cooldownUntil.get(provider.name) ?? 0) > Date.now()) continue;
    if (!rateLimit(`provider:${provider.name}`, maxPerMinute, 60_000).ok) continue;

    try {
      const tracks = await provider.search(query, SEARCH_LIMIT);
      return { tracks, provider: provider.name };
    } catch (error) {
      if (error instanceof ProviderError && error.kind === "quota") {
        cooldownUntil.set(provider.name, Date.now() + QUOTA_COOLDOWN_MS);
      }
      console.warn(
        `[music] ${provider.name} falló, probando el siguiente:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw new AllProvidersFailedError();
}

export async function searchTracks(rawQuery: string): Promise<SearchResult> {
  const query = normalizeQuery(rawQuery);
  const { value, cached } = await cache.getOrLoad(`${SEARCH_LIMIT}:${query}`, () =>
    searchWithFallback(query),
  );
  return { ...value, cached };
}
