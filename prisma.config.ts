import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // La CLI (migraciones) usa la conexión directa: el pooler de Neon no admite migraciones.
    // `prisma generate` no se conecta: sin URL (p. ej. un build sin variables) no debe fallar.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
