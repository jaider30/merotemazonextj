// Ruta destino: src/server/music/cache.ts
//
// Caché en memoria con expiración (TTL) y dos protecciones:
//  1) Si 50 personas buscan lo mismo a la vez, solo se hace UNA petición
//     externa; las otras 49 esperan esa misma respuesta (in-flight dedupe).
//  2) Tamaño máximo: al llenarse, se descarta la entrada más antigua.
//
// Los errores NO se guardan en caché, para que un fallo pasajero no se repita.
// Limitación: vive en la memoria de UNA instancia del servidor. En producción
// con varias instancias, esto se cambia por Redis (Upstash).

type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 1000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const now = Date.now();

    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) {
      return { value: hit.value, cached: true };
    }
    if (hit) this.store.delete(key);

    const pending = this.inflight.get(key);
    if (pending) {
      return { value: await pending, cached: true };
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return { value: await promise, cached: false };
  }

  // Invalida una entrada (por ejemplo, la cola de un club cuando alguien vota)
  delete(key: string): void {
    this.store.delete(key);
  }

  private set(key: string, value: T) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}