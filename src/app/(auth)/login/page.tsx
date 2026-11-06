// Ruta destino: src/app/(auth)/login/page.tsx
//
// Con Cache Components, lo dinámico (searchParams + sesión) va dentro de <Suspense>.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession, isAdmin } from "@/server/auth/session";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default function LoginPage({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Cargando…
        </main>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Props) {
  // Si ya inició sesión, no tiene sentido mostrar el login
  const session = await getSession();
  if (session) redirect(isAdmin(session.user) ? "/admin" : "/dashboard");

  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold">Merotemazo</h1>
          <p className="text-slate-400">Ingresa a tu panel</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : null} />
      </div>
    </main>
  );
}
