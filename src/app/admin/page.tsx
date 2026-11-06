// Ruta destino: src/app/admin/page.tsx
//
// Panel del administrador (versión mínima). requireAdmin() responde 404 a
// cualquiera que no sea admin. Después se agregan: crear clubes y cuentas de
// cliente, activar módulos y las métricas globales.

import { Suspense } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/server/auth/session";
import { listAllSites } from "@/server/services/owner-sites";

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-6 text-slate-400">Cargando el panel…</main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const { user } = await requireAdmin();
  const sites = await listAllSites();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Panel de administración</h1>
            <p className="truncate text-sm text-slate-400">
              {user.name} · {user.email}
            </p>
          </div>
          <SignOutButton />
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Todos los sitios ({sites.length})</h2>

          {/* Se desplaza en horizontal en pantallas pequeñas */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Sitio</th>
                  <th className="px-4 py-3 font-medium">Dueño</th>
                  <th className="px-4 py-3 font-medium">Nicho</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Pendientes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td className="px-4 py-3">
                      <Link href={`/${site.slug}`} className="font-medium hover:underline">
                        {site.name}
                      </Link>
                      <p className="text-xs text-slate-500">/{site.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{site.owner.name}</p>
                      <p className="text-xs text-slate-500">{site.owner.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{site.niche}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          site.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {site.status === "ACTIVE" ? "Activo" : "Suspendido"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{site._count.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-sm text-slate-500">
          Pronto: crear clubes y cuentas de cliente, activar módulos y ver las métricas globales.
        </p>
      </div>
    </main>
  );
}
