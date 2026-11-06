"use client";

// Ruta destino: src/components/auth/LoginForm.tsx

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Solo se permite volver a rutas internas del panel (evita redirecciones a
// sitios externos con un enlace manipulado: "open redirect").
function safeNext(next: string | null): string {
  if (next && /^\/(dashboard|admin)(\/|$)/.test(next)) return next;
  return "/dashboard";
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoading(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({ email, password });

    if (signInError) {
      setLoading(false);
      if (signInError.status === 429) {
        setError("Demasiados intentos. Espera un momento e intenta de nuevo.");
      } else if (signInError.status === 403) {
        setError("Tu cuenta está suspendida. Contacta al administrador.");
      } else {
        // Mensaje genérico a propósito: no revela si el correo existe
        setError("Correo o contraseña incorrectos.");
      }
      return;
    }

    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-300">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-300">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-xl bg-rose-600 font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
