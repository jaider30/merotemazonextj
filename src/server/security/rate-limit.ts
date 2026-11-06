// Ruta destino: src/server/security/rate-limit.ts
//
// Limitador por ventana fija, en memoria. Sirve para:
//  - limitar peticiones por IP a nuestros endpoints
//  - repartir el "presupuesto" de llamadas a cada proveedor de música
//
// Limitación: vive en la memoria de UNA instancia. En producción con varias
// instancias se reemplaza por Upstash Redis (misma interfaz de función).

type Bucket = { count: number; resetAt: number };

const globalForRateLimit = globalThis as unknown as {
  __rateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalForRateLimit.__rateLimitBuckets ??= new Map<string, Bucket>());

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Limpieza ocasional de ventanas vencidas para no crecer sin control
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true, remaining: limit - current.count, retryAfterSec: 0 };
}

// IP del cliente. Detrás de un proxy/CDN llega en x-forwarded-for.
// En local suele no venir, y se devuelve "unknown" (todos comparten ese cupo).
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
