// Ruta destino: src/app/api/auth/[...all]/route.ts
//
// Expone los endpoints de autenticación: /api/auth/sign-in/email,
// /api/auth/sign-out, /api/auth/get-session, etc.

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);