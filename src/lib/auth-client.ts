// Ruta destino: src/lib/auth-client.ts
//
// Cliente de autenticación para componentes de navegador ("use client"):
// authClient.signIn.email(...), authClient.signOut(), etc.
// Importante: se importa desde "better-auth/react".

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});