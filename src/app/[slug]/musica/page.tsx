// Ruta destino: src/app/[slug]/musica/page.tsx
//
// Página pública de peticiones musicales de un club.
// Con Cache Components activado, lo dinámico (params + base de datos) va
// dentro de <Suspense>. El color del club se pasa como variable CSS --brand.

import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MusicBoard } from "@/components/music/MusicBoard";
import { getMusicPageSite } from "@/server/services/sites";

type Props = {
  params: Promise<{ slug: string }>;
};

export default function MusicPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 p-6 text-slate-400">Cargando…</div>
      }
    >
      <MusicContent params={params} />
    </Suspense>
  );
}

async function MusicContent({ params }: Props) {
  const { slug } = await params;
  const site = await getMusicPageSite(slug);

  // 404 si el club no existe, está suspendido o no tiene el módulo de música
  if (!site) notFound();

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ "--brand": site.primaryColor } as CSSProperties}
    >
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          {site.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold" style={{ color: site.primaryColor }}>
              {site.name}
            </h1>
            <p className="truncate text-sm text-slate-400">Pide tu canción y vota por las demás</p>
          </div>
          <Link
            href={`/${site.slug}`}
            className="shrink-0 rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Inicio
          </Link>
        </div>
      </header>

      <MusicBoard club={site.slug} />
    </div>
  );
}
