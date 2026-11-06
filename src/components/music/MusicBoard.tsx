"use client";

// Ruta destino: src/components/music/MusicBoard.tsx
//
// Pantalla interactiva de peticiones musicales de un club:
//  - buscador (con espera de 450 ms tras dejar de escribir)
//  - resultados con botón "Pedir" / "Sumar voto"
//  - cola ordenada por puntaje con votos ▲▼ (se reflejan al instante)
//  - actualización automática cada 5 s (en pausa si la pestaña está oculta)
//  - lista plegable de canciones ya reproducidas
//
// Toma el color del club de la variable CSS --brand (la define la página).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  musicApi,
  type ClientPlayed,
  type ClientRequest,
  type ClientTrack,
} from "@/lib/music-client";

const POLL_MS = 5000;
const DEBOUNCE_MS = 450;
const MIN_CHARS = 2;
const NOTICE_MS = 3500;

type Notice = { kind: "ok" | "error"; text: string };
type SearchState = {
  term: string;
  tracks: ClientTrack[];
  loading: boolean;
  error: string | null;
};

const EMPTY_SEARCH: SearchState = { term: "", tracks: [], loading: false, error: null };

// ------------------------------ utilidades ------------------------------

const trackKey = (item: { provider: string; providerTrackId: string }) =>
  `${item.provider}:${item.providerTrackId}`;

// Mismo orden que el servidor: puntaje (mayor primero) y, si empatan, el más antiguo
function sortQueue(items: ClientRequest[]): ClientRequest[] {
  return [...items].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
}

// Misma lógica de votos que el servidor, para reflejarlo al instante
function applyVote(item: ClientRequest, value: 1 | -1): ClientRequest {
  let { upvotes, downvotes } = item;
  let myVote: number;

  if (item.myVote === value) {
    // pulsar la misma flecha quita el voto
    if (value === 1) upvotes -= 1;
    else downvotes -= 1;
    myVote = 0;
  } else {
    if (item.myVote === 1) upvotes -= 1;
    if (item.myVote === -1) downvotes -= 1;
    if (value === 1) upvotes += 1;
    else downvotes += 1;
    myVote = value;
  }

  return { ...item, upvotes, downvotes, score: upvotes - downvotes, myVote };
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "Vas muy rápido. Espera unos segundos e intenta de nuevo.";
    if (error.status === 503) return "El servicio no está disponible ahora. Intenta en un momento.";
    return error.message;
  }
  return "No hay conexión. Revisa tu internet.";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// ------------------------------ piezas UI ------------------------------

function Cover({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xl"
      >
        🎵
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-md bg-slate-800 object-cover"
    />
  );
}

function TrackText({
  title,
  artist,
  explicit,
}: {
  title: string;
  artist: string;
  explicit?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">
        {title}
        {explicit && (
          <span
            className="ml-2 rounded bg-slate-700 px-1 text-[10px] font-bold text-slate-300"
            title="Contenido explícito"
          >
            E
          </span>
        )}
      </p>
      <p className="truncate text-sm text-slate-400">{artist}</p>
    </div>
  );
}

// -------------------------------- principal --------------------------------

export function MusicBoard({ club }: { club: string }) {
  const [queue, setQueue] = useState<ClientRequest[]>([]);
  const [played, setPlayed] = useState<ClientPlayed[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [offline, setOffline] = useState(false);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [requestingKey, setRequestingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Cada acción del usuario sube la versión: una actualización que empezó ANTES
  // de la acción se descarta al llegar (evita que la lista "salte hacia atrás").
  const mutationVersion = useRef(0);
  const pendingVotes = useRef(new Set<string>());
  const queueRef = useRef<ClientRequest[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // ---------------- actualización automática de la cola ----------------
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const load = async () => {
      if (document.hidden) return;
      const version = mutationVersion.current;
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await musicApi.queue(club, controller.signal);
        if (!active || version !== mutationVersion.current) return;
        setQueue(data.queue);
        setPlayed(data.played);
        setQueueLoaded(true);
        setOffline(false);
      } catch (error) {
        if (!active || isAbort(error)) return;
        setOffline(true);
      }
    };

    void load();
    const timer = setInterval(load, POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [club]);

  // ------------------------------ buscador ------------------------------
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch((prev) => ({ ...prev, term, loading: true, error: null }));
      try {
        const data = await musicApi.search(club, term, controller.signal);
        setSearch({ term, tracks: data.tracks, loading: false, error: null });
      } catch (error) {
        if (isAbort(error)) return;
        setSearch((prev) => ({ ...prev, term, loading: false, error: friendlyError(error) }));
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, club]);

  // ----------------------------- avisos (toast) -----------------------------
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // ------------------------------ acciones ------------------------------

  const handleRequest = useCallback(
    async (track: ClientTrack) => {
      const key = trackKey(track);
      setRequestingKey(key);
      mutationVersion.current += 1;

      try {
        const result = await musicApi.requestTrack(club, track);
        mutationVersion.current += 1;

        const item: ClientRequest = { ...result.request, myVote: result.myVote };
        setQueue((current) => {
          const exists = current.some((r) => r.id === item.id);
          return sortQueue(exists ? current.map((r) => (r.id === item.id ? item : r)) : [...current, item]);
        });

        setNotice({
          kind: "ok",
          text:
            result.status === "created"
              ? "¡Pedida! Tu canción ya está en la cola."
              : result.status === "boosted"
                ? "Sumaste tu voto a esta canción."
                : "Ya habías votado por esta canción.",
        });

        // Limpia el buscador para volver a ver la cola completa
        setQuery("");
        setSearch(EMPTY_SEARCH);
      } catch (error) {
        setNotice({ kind: "error", text: friendlyError(error) });
      } finally {
        setRequestingKey(null);
      }
    },
    [club],
  );

  const handleVote = useCallback(
    async (requestId: string, value: 1 | -1) => {
      if (pendingVotes.current.has(requestId)) return;
      const previous = queueRef.current.find((r) => r.id === requestId);
      if (!previous) return;

      pendingVotes.current.add(requestId);
      mutationVersion.current += 1;

      // Reflejo inmediato (sin reordenar, para que nada se mueva bajo el dedo)
      setQueue((current) => current.map((r) => (r.id === requestId ? applyVote(r, value) : r)));

      try {
        const result = await musicApi.vote(club, requestId, value);
        mutationVersion.current += 1;
        setQueue((current) =>
          current.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  upvotes: result.request.upvotes,
                  downvotes: result.request.downvotes,
                  score: result.request.score,
                  myVote: result.myVote,
                }
              : r,
          ),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          // La canción ya no está en la cola (se reprodujo o la quitó el DJ)
          setQueue((current) => current.filter((r) => r.id !== requestId));
          setNotice({ kind: "error", text: "Esa canción ya no está en la cola." });
        } else {
          setQueue((current) => current.map((r) => (r.id === requestId ? previous : r)));
          setNotice({ kind: "error", text: friendlyError(error) });
        }
      } finally {
        pendingVotes.current.delete(requestId);
      }
    },
    [club],
  );

  // ------------------------------- render -------------------------------

  const term = query.trim();
  const searching = term.length >= MIN_CHARS;
  const queueByKey = new Map(queue.map((r) => [trackKey(r), r]));

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 pb-28 pt-4">
      {/* Buscador */}
      <section aria-label="Buscar canciones" className="space-y-3">
        <label htmlFor="song-search" className="block text-lg font-semibold">
          ¿Qué quieres escuchar?
        </label>
        <input
          id="song-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca una canción o artista…"
          autoComplete="off"
          autoCorrect="off"
          maxLength={80}
          className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />

        {searching && (
          <div className="space-y-2" aria-live="polite">
            {search.loading && <p className="text-sm text-slate-400">Buscando…</p>}
            {search.error && <p className="text-sm text-red-400">{search.error}</p>}
            {!search.loading && !search.error && search.term === term && search.tracks.length === 0 && (
              <p className="text-sm text-slate-400">No encontramos resultados para «{term}».</p>
            )}

            <ul className="space-y-2">
              {search.tracks.map((track) => {
                const key = trackKey(track);
                const existing = queueByKey.get(key);
                const alreadyVoted = existing?.myVote === 1;
                const busy = requestingKey === key;
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <Cover url={track.coverUrl} />
                    <TrackText title={track.title} artist={track.artist} explicit={track.explicit} />
                    <button
                      type="button"
                      onClick={() => void handleRequest(track)}
                      disabled={busy || alreadyVoted}
                      className="min-h-11 shrink-0 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {alreadyVoted ? "✓ Votada" : busy ? "Pidiendo…" : existing ? "Sumar voto" : "Pedir"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Cola */}
      <section aria-label="Cola de canciones" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">En la cola</h2>
          <span className="text-sm text-slate-400">
            {offline ? <span className="text-amber-400">Reconectando…</span> : `${queue.length} canciones`}
          </span>
        </div>

        {!queueLoaded && <p className="text-sm text-slate-400">Cargando la cola…</p>}

        {queueLoaded && queue.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            Aún no hay canciones. ¡Sé el primero en pedir una!
          </p>
        )}

        <ol className="space-y-2">
          {queue.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
            >
              <span className="w-5 shrink-0 text-center text-sm tabular-nums text-slate-500">
                {index + 1}
              </span>
              <Cover url={item.coverUrl} />
              <TrackText title={item.title} artist={item.artist} />
              <div className="flex shrink-0 flex-col items-center">
                <button
                  type="button"
                  aria-label={`Votar a favor de ${item.title}`}
                  aria-pressed={item.myVote === 1}
                  onClick={() => void handleVote(item.id, 1)}
                  className={`h-10 w-11 rounded-lg text-lg transition active:scale-90 ${
                    item.myVote === 1 ? "text-[var(--brand)]" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  ▲
                </button>
                <span className="text-sm font-bold tabular-nums">{item.score}</span>
                <button
                  type="button"
                  aria-label={`Votar en contra de ${item.title}`}
                  aria-pressed={item.myVote === -1}
                  onClick={() => void handleVote(item.id, -1)}
                  className={`h-10 w-11 rounded-lg text-lg transition active:scale-90 ${
                    item.myVote === -1 ? "text-red-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  ▼
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Ya sonaron */}
      {played.length > 0 && (
        <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <summary className="cursor-pointer font-medium text-slate-300">
            Ya sonaron ({played.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {played.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <Cover url={item.coverUrl} />
                <TrackText title={item.title} artist={item.artist} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Aviso flotante */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-0 bottom-5 z-20 mx-auto w-fit max-w-[90%] rounded-full px-5 py-3 text-sm font-medium shadow-lg ${
            notice.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
