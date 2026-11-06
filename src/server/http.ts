// Ruta destino: src/server/http.ts
//
// Respuestas JSON reutilizables para los endpoints. Todas llevan
// "Cache-Control: no-store" para que ningún CDN ni navegador las guarde.

import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function tooManyRequests(
  retryAfterSec: number,
  message = "Demasiadas peticiones. Intenta de nuevo en unos segundos.",
) {
  return json({ error: message }, 429, { "Retry-After": String(retryAfterSec) });
}