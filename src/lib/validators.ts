// Ruta destino: src/lib/validators.ts
//
// Esquemas de validación (zod). Todo lo que llega de internet se valida aquí
// antes de tocar la base de datos o una API externa.

import { z } from "zod";
import { SLUG_REGEX } from "@/lib/constants";

// ---------------------------- piezas comunes ----------------------------

const clubSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Club no válido")
  .max(60, "Club no válido")
  .regex(SLUG_REGEX, "Club no válido");

// Solo los proveedores que realmente usamos hoy
const providerSchema = z.enum(["DEEZER", "ITUNES"], {
  message: "Proveedor de música no válido",
});

// Los IDs de Deezer y de iTunes son numéricos
const trackIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, "ID de canción no válido");

// ------------------------------ endpoints -------------------------------

// GET /api/search?q=gasolina&club=club-fenix
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "La búsqueda debe tener al menos 2 caracteres")
    .max(80, "La búsqueda no puede superar 80 caracteres"),
  club: clubSchema,
});

// POST /api/requests
export const createRequestSchema = z.object({
  club: clubSchema,
  provider: providerSchema,
  providerTrackId: trackIdSchema,
});

// POST /api/votes  (1 = ▲, -1 = ▼)
export const voteSchema = z.object({
  club: clubSchema,
  requestId: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{10,40}$/i, "ID de petición no válido"),
  value: z.union([z.literal(1), z.literal(-1)], { message: "El voto debe ser 1 o -1" }),
});

// GET /api/queue?club=club-fenix
export const queueQuerySchema = z.object({
  club: clubSchema,
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type VoteInput = z.infer<typeof voteSchema>;