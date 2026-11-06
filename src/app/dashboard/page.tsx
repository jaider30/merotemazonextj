// Ruta destino: src/app/dashboard/page.tsx
//
// Panel del cliente (versión mínima). Muestra SOLO los clubes de quien inició
// sesión. Después se agregan: perfil, carta, eventos, QR y la vista del DJ.

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { isAdmin, requireUser } from "@/server/auth/session";
import { listOwnedSites } from "@/server/services/owner-sites";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-6 text-slate-400">Cargando tu panel…</main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { user } = await requireUser();

  // El admin no tiene clubes propios: va a su panel
  if (isAdmin(user)) redirect("/admin");

  // El id viene de la sesión, no de la URL
  const sites = await listOwnedSites(user.id);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Hola, {user.name}</h1>
            <p className="truncate text-sm text-slate-400">{user.email}</p>
          </div>
          <SignOutButton />
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Tus clubes</h2>

          {sites.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              Todavía no tienes clubes asignados. Contacta al administrador.
            </p>
          )}

          <ul className="space-y-3">
            {sites.map((site) => (
              <li
                key={site.id}
                className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold" style={{ color: site.primaryColor }}>
                      {site.name}
                    </h3>
                    <p className="text-sm text-slate-500">/{site.slug}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      site.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {site.status === "ACTIVE" ? "Activo" : "Suspendido"}
                  </span>
                </div>

                <p className="text-sm text-slate-400">
                  Canciones pendientes: <strong className="text-slate-200">{site._count.requests}</strong>
                </p>

                <div className="flex flex-wrap gap-2 text-sm">
                  <Link
                    href={`/${site.slug}`}
                    className="rounded-full border border-slate-700 px-4 py-2 hover:border-slate-500"
                  >
                    Ver mi sitio
                  </Link>
                  <Link
                    href={`/${site.slug}/musica`}
                    className="rounded-full border border-slate-700 px-4 py-2 hover:border-slate-500"
                  >
                    Ver peticiones
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm text-slate-500">
          Pronto: editar perfil, carta, eventos, descargar el QR y la vista del DJ.
        </p>
      </div>
    </main>
  );
}
