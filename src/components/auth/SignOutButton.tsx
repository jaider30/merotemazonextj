"use client";

// Ruta destino: src/components/auth/SignOutButton.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 disabled:opacity-60"
    >
      {loading ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
