// Ruta destino: src/server/services/requests.ts
//
// Lógica del módulo de canciones. Los endpoints solo llaman a estas funciones.
//
//  - submitSongRequest: pedir una canción (o sumar tu voto si ya está en cola)
//  - castVote:          votar ▲ / ▼ (pulsar la misma flecha otra vez quita el voto)
//  - listQueue:         cola pendiente + últimas reproducidas (caché de 3 s)

import { Prisma, RequestStatus, type MusicProvider } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { TtlCache } from "@/server/music/cache";
import type { MusicTrack } from "@/server/music/types";

// --------------------------- configuración ---------------------------

const COOLDOWN_MINUTES = 45; // no se puede volver a pedir una canción recién reproducida
const QUEUE_SIZE = 50;
const PLAYED_SIZE = 10;
const QUEUE_CACHE_MS = 3000;

// ------------------------------ tipos --------------------------------

// Solo se expone esto al público: nunca voterHash, pendingKey ni siteId
const publicSelect = {
  id: true,
  provider: true,
  providerTrackId: true,
  title: true,
  artist: true,
  coverUrl: true,
  upvotes: true,
  downvotes: true,
  score: true,
  createdAt: true,
} satisfies Prisma.SongRequestSelect;

const playedSelect = { ...publicSelect, playedAt: true } satisfies Prisma.SongRequestSelect;

export type PublicRequest = Prisma.SongRequestGetPayload<{ select: typeof publicSelect }>;
type PlayedRequest = Prisma.SongRequestGetPayload<{ select: typeof playedSelect }>;

type VoteValue = 1 | -1;

export type VoteOutcome = {
  request: { id: string; upvotes: number; downvotes: number; score: number };
  myVote: 0 | 1 | -1;
  changed: boolean;
};

export type SubmitResult =
  | { status: "created" | "boosted" | "already_voted"; request: PublicRequest; myVote: 1 }
  | { status: "recently_played"; retryAfterMin: number }
  | { status: "conflict" };

// ------------------------------ utilidades ---------------------------

function makePendingKey(siteId: string, provider: MusicProvider, providerTrackId: string) {
  return `${siteId}:${provider}:${providerTrackId}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ------------------------------- cola --------------------------------

type QueueSnapshot = { queue: PublicRequest[]; played: PlayedRequest[] };

// Se guarda en globalThis para sobrevivir a las recargas de Next en desarrollo
const globalForQueue = globalThis as unknown as { __queueCache?: TtlCache<QueueSnapshot> };
const queueCache = (globalForQueue.__queueCache ??= new TtlCache<QueueSnapshot>(QUEUE_CACHE_MS, 500));

export function invalidateQueue(siteId: string) {
  queueCache.delete(siteId);
}

export async function listQueue(siteId: string, voterHash: string | null) {
  // Parte compartida por todos los usuarios del club (se cachea 3 s)
  const { value } = await queueCache.getOrLoad(siteId, async () => {
    const [queue, played] = await Promise.all([
      prisma.songRequest.findMany({
        where: { siteId, status: RequestStatus.PENDING },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: QUEUE_SIZE,
        select: publicSelect,
      }),
      prisma.songRequest.findMany({
        where: { siteId, status: RequestStatus.PLAYED },
        orderBy: { playedAt: "desc" },
        take: PLAYED_SIZE,
        select: playedSelect,
      }),
    ]);
    return { queue, played };
  });

  // Parte personal: qué votó ESTE usuario
  const myVotes = new Map<string, number>();
  if (voterHash && value.queue.length > 0) {
    const votes = await prisma.vote.findMany({
      where: { voterHash, requestId: { in: value.queue.map((r) => r.id) } },
      select: { requestId: true, value: true },
    });
    for (const vote of votes) myVotes.set(vote.requestId, vote.value);
  }

  return {
    queue: value.queue.map((r) => ({ ...r, myVote: myVotes.get(r.id) ?? 0 })),
    played: value.played,
  };
}

// ------------------------------ votar --------------------------------

/**
 * Registra el voto de un votante.
 *  - toggle = true  (botones ▲▼): pulsar la misma flecha otra vez quita el voto.
 *  - toggle = false (pedir una canción ya en cola): solo asegura un ▲, nunca lo quita.
 * Devuelve null si la petición no existe, es de otro club o ya no está pendiente.
 */
export async function castVote(input: {
  siteId: string;
  requestId: string;
  voterHash: string;
  value: VoteValue;
  toggle: boolean;
}): Promise<VoteOutcome | null> {
  try {
    return await castVoteOnce(input);
  } catch (error) {
    // Carrera: el mismo votante envió dos votos a la vez. Se reintenta una vez.
    if (isUniqueViolation(error)) return castVoteOnce(input);
    throw error;
  }
}

async function castVoteOnce(input: {
  siteId: string;
  requestId: string;
  voterHash: string;
  value: VoteValue;
  toggle: boolean;
}): Promise<VoteOutcome | null> {
  const { siteId, requestId, voterHash, value, toggle } = input;

  const outcome = await prisma.$transaction(async (tx): Promise<VoteOutcome | null> => {
    const request = await tx.songRequest.findFirst({
      where: { id: requestId, siteId, status: RequestStatus.PENDING },
      select: { id: true, upvotes: true, downvotes: true, score: true },
    });
    if (!request) return null;

    const existing = await tx.vote.findUnique({
      where: { requestId_voterHash: { requestId, voterHash } },
    });

    let myVote: 0 | 1 | -1;
    let deltaUp = 0;
    let deltaDown = 0;

    if (!existing) {
      await tx.vote.create({ data: { requestId, voterHash, value } });
      myVote = value;
      if (value === 1) deltaUp = 1;
      else deltaDown = 1;
    } else if (existing.value === value) {
      if (!toggle) return { request, myVote: value, changed: false };
      await tx.vote.delete({ where: { id: existing.id } });
      myVote = 0;
      if (value === 1) deltaUp = -1;
      else deltaDown = -1;
    } else {
      await tx.vote.update({ where: { id: existing.id }, data: { value } });
      myVote = value;
      if (value === 1) {
        deltaUp = 1;
        deltaDown = -1;
      } else {
        deltaUp = -1;
        deltaDown = 1;
      }
    }

    // Incrementos atómicos: dos votos simultáneos no se pisan
    const updated = await tx.songRequest.update({
      where: { id: requestId },
      data: {
        upvotes: { increment: deltaUp },
        downvotes: { increment: deltaDown },
        score: { increment: deltaUp - deltaDown },
      },
      select: { id: true, upvotes: true, downvotes: true, score: true },
    });

    return { request: updated, myVote, changed: true };
  });

  if (outcome?.changed) invalidateQueue(siteId);
  return outcome;
}

// ---------------------------- pedir canción ---------------------------

async function boost(siteId: string, requestId: string, voterHash: string): Promise<SubmitResult> {
  const outcome = await castVote({ siteId, requestId, voterHash, value: 1, toggle: false });
  const request = await prisma.songRequest.findUnique({
    where: { id: requestId },
    select: publicSelect,
  });

  // La canción se reprodujo o se rechazó justo en este instante
  if (!outcome || !request) return { status: "conflict" };

  return { status: outcome.changed ? "boosted" : "already_voted", request, myVote: 1 };
}

/**
 * Pide una canción en un club.
 *  1) Si ya está pendiente en ese club  → suma tu voto (no se duplica).
 *  2) Si sonó hace poco                 → se rechaza (cooldown).
 *  3) Si es nueva                       → se consultan sus datos reales con
 *     `fetchTrack` y se crea la petición con tu voto ▲ incluido.
 * `fetchTrack` solo se ejecuta en el caso 3, para no gastar cuota externa.
 */
export async function submitSongRequest(
  input: {
    siteId: string;
    voterHash: string;
    provider: MusicProvider;
    providerTrackId: string;
  },
  fetchTrack: () => Promise<MusicTrack>,
): Promise<SubmitResult> {
  const { siteId, voterHash, provider, providerTrackId } = input;
  const pendingKey = makePendingKey(siteId, provider, providerTrackId);

  // 1) ¿Ya está en la cola?
  const existing = await prisma.songRequest.findUnique({
    where: { pendingKey },
    select: { id: true },
  });
  if (existing) return boost(siteId, existing.id, voterHash);

  // 2) ¿Sonó hace poco?
  const cutoff = new Date(Date.now() - COOLDOWN_MINUTES * 60_000);
  const recentlyPlayed = await prisma.songRequest.findFirst({
    where: {
      siteId,
      provider,
      providerTrackId,
      status: RequestStatus.PLAYED,
      playedAt: { gte: cutoff },
    },
    orderBy: { playedAt: "desc" },
    select: { playedAt: true },
  });
  if (recentlyPlayed?.playedAt) {
    const elapsedMin = (Date.now() - recentlyPlayed.playedAt.getTime()) / 60_000;
    return {
      status: "recently_played",
      retryAfterMin: Math.max(1, Math.ceil(COOLDOWN_MINUTES - elapsedMin)),
    };
  }

  // 3) Es nueva: datos reales desde el proveedor y creación
  const track = await fetchTrack();

  try {
    const created = await prisma.songRequest.create({
      data: {
        siteId,
        provider,
        providerTrackId,
        title: track.title.slice(0, 255),
        artist: track.artist.slice(0, 255),
        coverUrl: track.coverUrl,
        durationMs: track.durationSec != null ? track.durationSec * 1000 : null,
        status: RequestStatus.PENDING,
        upvotes: 1,
        downvotes: 0,
        score: 1,
        pendingKey,
        votes: { create: { voterHash, value: 1 } },
      },
      select: publicSelect,
    });
    invalidateQueue(siteId);
    return { status: "created", request: created, myVote: 1 };
  } catch (error) {
    // Carrera: otra persona creó la misma canción un instante antes → sumamos voto
    if (isUniqueViolation(error)) {
      const winner = await prisma.songRequest.findUnique({
        where: { pendingKey },
        select: { id: true },
      });
      if (winner) return boost(siteId, winner.id, voterHash);
    }
    throw error;
  }
}