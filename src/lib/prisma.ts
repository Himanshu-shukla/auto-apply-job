import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
type PrismaClientWithPhase2 = PrismaClient & Record<string, any>;
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ai_job_copilot?schema=public";
const adapter = new PrismaPg({ connectionString });

export const prisma: PrismaClientWithPhase2 =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  }) as PrismaClientWithPhase2;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
