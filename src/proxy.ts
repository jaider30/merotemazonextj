// Ruta destino: src/proxy.ts   (en Next 16 reemplaza a middleware.ts)
//
// ⚠️ ESTO NO ES LA SEGURIDAD REAL. Solo comprueba que EXISTA una cookie de
// sesión (no que sea válida) para redirigir rápido a /login sin tocar la base
// de datos. La validación de verdad ocurre en cada página con requireUser() /
// requireAdmin() (src/server/auth/session.ts). Nunca quites esas llamadas
// pensando que el proxy ya protege la ruta.
//
// Importante: no dejes un middleware.ts junto a este archivo; Next.js no
// admite los dos a la vez.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};