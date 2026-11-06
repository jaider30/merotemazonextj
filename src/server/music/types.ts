// Ruta destino: src/server/music/types.ts
//
// Contrato común para cualquier proveedor de música (Deezer, iTunes, y en el
// futuro Apple Music). El resto de la aplicación solo conoce estos tipos, así
// que cambiar de proveedor no obliga a tocar páginas ni endpoints.

import type { MusicProvider as MusicProviderName } from "@prisma/client";

export type { MusicProviderName };

export type MusicTrack = {
  provider: MusicProviderName; // "DEEZER" | "ITUNES" | ...
  providerTrackId: string; // ID estable de la canción en ese proveedor
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  durationSec: number | null;
  explicit: boolean;
};

export interface MusicProvider {
  readonly name: MusicProviderName;
  search(query: string, limit: number): Promise<MusicTrack[]>;
}

export type ProviderErrorKind = "quota" | "unavailable" | "bad_response";

// Error de UN proveedor (el servicio de búsqueda prueba con el siguiente)
export class ProviderError extends Error {
  readonly provider: MusicProviderName;
  readonly kind: ProviderErrorKind;

  constructor(provider: MusicProviderName, kind: ProviderErrorKind, message: string) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
  }
}

// Ningún proveedor pudo responder
export class AllProvidersFailedError extends Error {
  constructor() {
    super("Ningún proveedor de música pudo responder");
    this.name = "AllProvidersFailedError";
  }
}
