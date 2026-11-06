// Ruta destino: src/server/auth/session.ts
//
// Aquí vive la seguridad REAL de los paneles. Toda página, acción o endpoint
// protegido debe llamar a requireUser() o requireAdmin() en el SERVIDOR.
// El proxy.ts solo hace una redirección rápida y NO sustituye esto.
//
// Importante con Cache Components: estas funciones leen cookies/headers, así
// que deben llamarse dentro de un componente envuelto en <Suspense>.

import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// cache() evita consultar la sesión varias veces dentro de la misma petición
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// El campo role puede tener varios roles separados por coma ("admin,user")
export function hasRole(role: string | null | undefined, wanted: string): boolean {
  return (role ?? "")
    .split(",")
    .map((item) => item.trim())
    .includes(wanted);
}

export function isAdmin(user: { role?: string | null }): boolean {
  return hasRole(user.role, "admin");
}

/** Exige sesión iniciada; si no hay, redirige a /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige rol admin; si no lo es, responde 404 (la ruta "no existe" para él). */
export async function requireAdmin() {
  const session = await requireUser();
  if (!isAdmin(session.user)) notFound();
  return session;
}