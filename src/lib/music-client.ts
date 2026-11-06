// Ruta destino: src/lib/music-client.ts
//
// Funciones y tipos que usa la interfaz (navegador) para hablar con nuestra
// API: /api/search, /api/requests, /api/votes y /api/queue.
// Las cookies del votante viajan solas (mismo origen).

export type ProviderName = "DEEZER" | "ITUNES";

export type ClientTrack = {
  provider: ProviderName;
  providerTrackId: string;
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  durationSec: number | null;
  explicit: boolean;
};

export type ClientRequest = {
  id: string;
  provider: ProviderName;
  providerTrackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  createdAt: string; // ISO
  myVote: number; // 1, -1 o 0 (sin voto)
};

export type ClientPlayed = Omit<ClientRequest, "myVote"> & { playedAt: string | null };

export type SearchResponse = { tracks: ClientTrack[]; provider: ProviderName; cached: boolean };
export type QueueResponse = { queue: ClientRequest[]; played: ClientPlayed[] };
export type RequestResponse = {
  status: "created" | "boosted" | "already_voted";
  request: Omit<ClientRequest, "myVote">;
  myVote: number;
};
export type VoteResponse = {
  request: { id: string; upvotes: number; downvotes: number; score: number };
  myVote: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly retryAfterSec: number | undefined;

  constructor(status: number, message: string, code?: string, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    cache: "no-store",
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; code?: string };
    const retry = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      response.status,
      body.error ?? "Algo salió mal. Intenta de nuevo.",
      body.code,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }

  return data as T;
}

export const musicApi = {
  search(club: string, q: string, signal?: AbortSignal) {
    return call<SearchResponse>(
      `/api/search?club=${encodeURIComponent(club)}&q=${encodeURIComponent(q)}`,
      { signal },
    );
  },

  queue(club: string, signal?: AbortSignal) {
    return call<QueueResponse>(`/api/queue?club=${encodeURIComponent(club)}`, { signal });
  },

  requestTrack(club: string, track: Pick<ClientTrack, "provider" | "providerTrackId">) {
    return call<RequestResponse>("/api/requests", {
      method: "POST",
      body: JSON.stringify({
        club,
        provider: track.provider,
        providerTrackId: track.providerTrackId,
      }),
    });
  },

  vote(club: string, requestId: string, value: 1 | -1) {
    return call<VoteResponse>("/api/votes", {
      method: "POST",
      body: JSON.stringify({ club, requestId, value }),
    });
  },
};