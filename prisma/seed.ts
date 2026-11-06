// Ruta destino: prisma/seed.ts
//
// Datos de PRUEBA para desarrollo. Se ejecuta con:  npx prisma db seed
// Es idempotente: puedes correrlo varias veces sin duplicar usuarios ni el club.
// NUNCA lo ejecutes en producción (las contraseñas son de ejemplo).

import {
  PrismaClient,
  Niche,
  SiteStatus,
  ModuleKey,
  EventType,
  MusicProvider,
  RequestStatus,
  ActivityType,
} from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";

const prisma = new PrismaClient();

// Instancia de Better Auth SOLO para el seed (sin dependencias de Next.js).
// Usa el mismo cifrado de contraseñas que la app real. El secreto no importa
// aquí porque el seed no crea sesiones.
const authForSeed = betterAuth({
  database: prismaAdapter(prisma, { provider: "mysql" }),
  secret: process.env.BETTER_AUTH_SECRET ?? "seed-only-secret-seed-only-secret-0000",
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [adminPlugin()],
});

// Crea el usuario si no existe (la contraseña se guarda cifrada en la tabla Account)
async function ensureUser(input: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return existing;

  await authForSeed.api.createUser({ body: input });
  return prisma.user.findUniqueOrThrow({ where: { email: input.email } });
}

const ADMIN = { email: "admin@merotemazo.com", password: "Admin12345!" };
const CLIENT = { email: "cliente@clubfenix.com", password: "Cliente12345!" };
const CLIENT2 = { email: "cliente2@laterraza.com", password: "Cliente12345!" };
const SITE_SLUG = "club-fenix";

// ---------- utilidades ----------

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];

// Próximo sábado a la hora indicada
function nextSaturday(hour: number): Date {
  const d = new Date();
  const daysUntil = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ---------- seed ----------

async function main() {
  console.log("🌱 Iniciando seed...");

  // 1) Usuarios
  const admin = await ensureUser({
    email: ADMIN.email,
    password: ADMIN.password,
    name: "Administrador Merotemazo",
    role: "admin",
  });

  const client = await ensureUser({
    email: CLIENT.email,
    password: CLIENT.password,
    name: "Dueño Club Fénix",
    role: "user", // "user" = cliente (dueño de un club)
  });

  const client2 = await ensureUser({
    email: CLIENT2.email,
    password: CLIENT2.password,
    name: "Dueño La Terraza",
    role: "user",
  });

  // 2) Sitio (club de prueba)
  const site = await prisma.site.upsert({
    where: { slug: SITE_SLUG },
    update: {},
    create: {
      ownerId: client.id,
      slug: SITE_SLUG,
      name: "Club Fénix",
      niche: Niche.CLUB,
      status: SiteStatus.ACTIVE,
      tagline: "La noche que no quieres que termine",
      description:
        "Club de prueba de Merotemazo. Música para bailar toda la noche, cocteles de autor y los mejores DJs.",
      address: "Calle 83 # 13-20 (dirección de prueba)",
      city: "Bogotá",
      latitude: 4.6672,
      longitude: -74.0536,
      mapsUrl: "https://www.google.com/maps?q=4.6672,-74.0536&output=embed",
      instagram: "https://instagram.com/clubfenix",
      facebook: "https://facebook.com/clubfenix",
      tiktok: "https://tiktok.com/@clubfenix",
      whatsapp: "+573000000000",
      primaryColor: "#e11d48",
      secondaryColor: "#0f172a",
    },
  });

  // 3) Módulo de música activo
  await prisma.siteModule.upsert({
    where: { siteId_module: { siteId: site.id, module: ModuleKey.MUSIC } },
    update: {},
    create: { siteId: site.id, module: ModuleKey.MUSIC },
  });

  // 3b) Segundo club de OTRO dueño, para probar el aislamiento entre clientes
  const site2 = await prisma.site.upsert({
    where: { slug: "la-terraza" },
    update: {},
    create: {
      ownerId: client2.id,
      slug: "la-terraza",
      name: "La Terraza",
      niche: Niche.BAR,
      status: SiteStatus.ACTIVE,
      tagline: "Música y cocteles al aire libre",
      address: "Carrera 7 # 45-10 (dirección de prueba)",
      city: "Bogotá",
      primaryColor: "#0ea5e9",
    },
  });

  await prisma.siteModule.upsert({
    where: { siteId_module: { siteId: site2.id, module: ModuleKey.MUSIC } },
    update: {},
    create: { siteId: site2.id, module: ModuleKey.MUSIC },
  });

  // 4) Limpiar datos hijos para poder re-ejecutar el seed sin duplicar
  await prisma.activityLog.deleteMany({ where: { siteId: site.id } });
  await prisma.songRequest.deleteMany({ where: { siteId: site.id } }); // borra sus votos en cascada
  await prisma.event.deleteMany({ where: { siteId: site.id } });
  await prisma.catalogItem.deleteMany({ where: { siteId: site.id } });
  await prisma.catalogCategory.deleteMany({ where: { siteId: site.id } });

  // 5) Catálogo (precios en COP)
  const catalog: {
    name: string;
    items: { name: string; price: number; description?: string }[];
  }[] = [
    {
      name: "Cocteles",
      items: [
        { name: "Mojito", price: 28000, description: "Ron, hierbabuena, limón y soda" },
        { name: "Margarita", price: 30000, description: "Tequila, triple sec y limón" },
        { name: "Piña colada", price: 29000, description: "Ron, crema de coco y piña" },
        { name: "Old Fashioned", price: 35000, description: "Whisky, azúcar y amargo de angostura" },
      ],
    },
    {
      name: "Cervezas",
      items: [
        { name: "Cerveza nacional", price: 9000 },
        { name: "Cerveza premium", price: 11000 },
        { name: "Cerveza importada", price: 14000 },
      ],
    },
    {
      name: "Botellas",
      items: [
        { name: "Aguardiente (media)", price: 90000, description: "Incluye mezcladores" },
        { name: "Ron (botella)", price: 180000, description: "Incluye mezcladores" },
        { name: "Whisky (botella)", price: 320000, description: "Incluye mezcladores" },
      ],
    },
  ];

  for (const [i, cat] of catalog.entries()) {
    const category = await prisma.catalogCategory.create({
      data: { siteId: site.id, name: cat.name, position: i },
    });
    await prisma.catalogItem.createMany({
      data: cat.items.map((item, j) => ({
        siteId: site.id,
        categoryId: category.id,
        name: item.name,
        description: item.description ?? null,
        price: item.price,
        position: j,
      })),
    });
  }

  // 6) Eventos y promociones
  await prisma.event.createMany({
    data: [
      {
        siteId: site.id,
        type: EventType.EVENT,
        title: "Noche de Reggaetón con DJ Kairo",
        description: "Puertas abiertas desde las 9 pm. Entrada libre hasta las 11 pm.",
        startsAt: nextSaturday(21),
        endsAt: new Date(nextSaturday(21).getTime() + 7 * 60 * 60 * 1000), // dura 7 horas
      },
      {
        siteId: site.id,
        type: EventType.PROMOTION,
        title: "2x1 en cocteles",
        description: "Todos los jueves hasta las 11 pm.",
      },
    ],
  });

  // 7) Canciones pedidas con votos aleatorios (la última queda como ya reproducida)
  const songs = [
    { title: "Gasolina", artist: "Daddy Yankee" },
    { title: "Danza Kuduro", artist: "Don Omar" },
    { title: "Provenza", artist: "Karol G" },
    { title: "La Bachata", artist: "Manuel Turizo" },
    { title: "Pepas", artist: "Farruko" },
    { title: "Mi Gente", artist: "J Balvin" },
  ];

  for (const [i, song] of songs.entries()) {
    const isPlayed = i === songs.length - 1;
    const trackId = `seed-track-${i}`;

    const votes = Array.from({ length: rand(3, 25) }, (_, v) => ({
      voterHash: `seed-voter-${i}-${v}`,
      value: Math.random() < 0.7 ? 1 : -1,
    }));
    const upvotes = votes.filter((v) => v.value === 1).length;
    const downvotes = votes.length - upvotes;

    await prisma.songRequest.create({
      data: {
        siteId: site.id,
        provider: MusicProvider.DEEZER,
        providerTrackId: trackId,
        title: song.title,
        artist: song.artist,
        status: isPlayed ? RequestStatus.PLAYED : RequestStatus.PENDING,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        pendingKey: isPlayed ? null : `${site.id}:DEEZER:${trackId}`,
        playedAt: isPlayed ? new Date() : null,
        votes: { create: votes },
      },
    });
  }

  // 8) Actividad aleatoria de los últimos 7 días (para los dashboards)
  const activityTypes = [
    ActivityType.VISIT,
    ActivityType.VISIT,
    ActivityType.VISIT,
    ActivityType.SEARCH,
    ActivityType.SEARCH,
    ActivityType.REQUEST,
    ActivityType.VOTE,
    ActivityType.VOTE,
    ActivityType.VOTE,
  ];
  const sampleQueries = ["reggaeton", "salsa", "karol g", "bad bunny", "crossover", "merengue"];

  await prisma.activityLog.createMany({
    data: Array.from({ length: 150 }, () => {
      const type = pick(activityTypes);
      return {
        siteId: site.id,
        type,
        voterHash: `seed-voter-${rand(1, 40)}`,
        createdAt: new Date(Date.now() - rand(0, 7 * 24 * 60 * 60 * 1000)),
        ...(type === ActivityType.SEARCH ? { metadata: { query: pick(sampleQueries) } } : {}),
      };
    }),
  });

  console.log("✅ Seed completado.\n");
  console.log("   ADMIN   →", ADMIN.email, "/", ADMIN.password, `(id: ${admin.id})`);
  console.log("   CLIENTE →", CLIENT.email, "/", CLIENT.password);
  console.log("   CLIENTE 2 →", CLIENT2.email, "/", CLIENT2.password);
  console.log(`   CLUB    → http://localhost:3000/${SITE_SLUG}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Error en el seed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });