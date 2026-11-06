// Ruta destino: src/lib/auth.ts
//
// Configuración central de autenticación (Better Auth).
//
//  - Correo + contraseña. El REGISTRO PÚBLICO ESTÁ DESACTIVADO: solo existen
//    las cuentas que crea el admin (o el seed / la CLI para el primer admin).
//  - Roles: "admin" (tú) y "user" (cliente, dueño de un club).
//  - nextCookies() debe ser SIEMPRE el último plugin de la lista.
//
// Variables de entorno: BETTER_AUTH_SECRET y BETTER_AUTH_URL.
// Opcional: BETTER_AUTH_TRUSTED_ORIGINS="http://192.168.1.54:3000" (separadas
// por coma) para poder iniciar sesión desde el celular durante el desarrollo.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "@/server/db/prisma";

const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  // Cuando migres a PostgreSQL (Supabase/Neon), cambia "mysql" por "postgresql"
  database: prismaAdapter(prisma, { provider: "mysql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: extraOrigins,

  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // nadie puede registrarse solo
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(), // siempre el último
  ],
});

export type AuthSession = typeof auth.$Infer.Session;