// Ruta destino: src/app/[slug]/page.tsx
//
// Página pública de PRUEBA para verificar que base de datos, Prisma y la
// ruta dinámica funcionan. Más adelante la reemplazaremos por el diseño final.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicSiteBySlug } from "@/server/services/sites";

// Con Cache Components activado NO se usa `export const dynamic = "force-dynamic"`.
// Lo dinámico (params + consulta a la base de datos) va dentro de <Suspense>.

type Props = {
  params: Promise<{ slug: string }>;
};

export default function SitePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6 text-slate-400">Cargando...</main>
      }
    >
      <SiteContent params={params} />
    </Suspense>
  );
}

async function SiteContent({ params }: Props) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);

  if (!site) notFound();

  const money = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: site.currency,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (date: Date) =>
    date.toLocaleString("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: site.timezone,
    });

  const hasMusic = site.modules.some((m) => m.module === "MUSIC");

  return (
    <main className="mx-auto max-w-3xl space-y-10 bg-slate-950 p-6 text-slate-100">
      {/* Cabecera */}
      <header className="space-y-2">
        <h1 className="text-4xl font-bold" style={{ color: site.primaryColor }}>
          {site.name}
        </h1>
        {site.tagline && <p className="text-lg text-slate-300">{site.tagline}</p>}
        {site.description && <p className="text-slate-400">{site.description}</p>}
        <p className="text-sm text-slate-500">
          Nicho: {site.niche} · Dueño (ownerId): {site.ownerId}
        </p>
      </header>

      {/* Ubicación */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Ubicación</h2>
        <p>
          {site.address}
          {site.city ? `, ${site.city}` : ""}
        </p>
        {site.mapsUrl && (
          <iframe
            src={site.mapsUrl}
            title={`Mapa de ${site.name}`}
            className="h-64 w-full rounded-lg border-0"
            loading="lazy"
          />
        )}
      </section>

      {/* Catálogo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Carta</h2>
        {site.categories.map((category) => (
          <div key={category.id} className="space-y-2">
            <h3 className="text-xl font-medium" style={{ color: site.primaryColor }}>
              {category.name}
            </h3>
            <ul className="divide-y divide-slate-800">
              {category.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-2">
                  <div>
                    <p>{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-slate-500">{item.description}</p>
                    )}
                  </div>
                  <span className="font-mono">{money(item.price.toNumber())}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Eventos y promociones */}
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Eventos y promociones</h2>
        {site.events.map((event) => (
          <article key={event.id} className="rounded-lg border border-slate-800 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {event.type === "PROMOTION" ? "Promoción" : "Evento"}
            </p>
            <h3 className="text-lg font-medium">{event.title}</h3>
            {event.description && <p className="text-slate-400">{event.description}</p>}
            {event.startsAt && (
              <p className="text-sm text-slate-500">{formatDate(event.startsAt)}</p>
            )}
          </article>
        ))}
      </section>

      {/* Cola de canciones (solo si el módulo MUSIC está activo) */}
      {hasMusic && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Canciones más pedidas</h2>
          <ol className="space-y-2">
            {site.requests.map((request, index) => (
              <li
                key={request.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 p-3"
              >
                <div>
                  <p className="font-medium">
                    {index + 1}. {request.title}
                  </p>
                  <p className="text-sm text-slate-500">{request.artist}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-lg font-bold">{request.score}</p>
                  <p className="text-slate-500">
                    ▲ {request.upvotes} · ▼ {request.downvotes}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
