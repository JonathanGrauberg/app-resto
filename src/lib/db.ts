import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente Prisma "crudo" (sin filtro de tenant).
 * Usarlo solo para: auth, panel de plataforma y resolución de tenant por slug.
 * Para datos de negocio usar `tenantDb(tenantId)` de `@/lib/tenant-db`.
 */
function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
