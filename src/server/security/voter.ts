// Ruta destino: src/server/security/voter.ts
//
// Identidad ANÓNIMA del votante (sin login):
//  - Cookie httpOnly "mt_voter" con un UUID aleatorio que genera el servidor.
//  - En la base de datos solo se guarda HMAC-SHA256(secreto, UUID), nunca el UUID.
//
// Qué protege: el doble voto casual (pulsar varias veces, recargar la página).
// Qué NO protege: a quien borre cookies a propósito. Por eso se combina con
// límites por IP/votante y con la restricción única de la base de datos.
// Importante: solo funciona dentro de Route Handlers / Server Actions
// (en Server Components no se pueden escribir cookies).

import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "mt_voter";
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSecret(): string {
  const secret = process.env.VOTER_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Falta VOTER_HASH_SECRET en .env (mínimo 32 caracteres). Genera uno con: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return secret;
}

export function hashVoterId(voterId: string): string {
  return createHmac("sha256", getSecret()).update(voterId).digest("hex");
}

/**
 * Devuelve el hash del votante actual. Si no tiene cookie (o es inválida),
 * crea una nueva y la deja en la respuesta.
 */
export async function getVoter(): Promise<{ voterHash: string; isNew: boolean }> {
  const store = await cookies();
  const current = store.get(COOKIE_NAME)?.value;

  if (current && UUID_REGEX.test(current)) {
    return { voterHash: hashVoterId(current), isNew: false };
  }

  const voterId = randomUUID();
  store.set(COOKIE_NAME, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production", // en localhost (http) debe ser false
    path: "/",
    maxAge: ONE_YEAR_SEC,
  });
  return { voterHash: hashVoterId(voterId), isNew: true };
}