/**
 * Prisma client singleton (ADR-002).
 *
 * Next.js dev mode reloads modules on every edit, so a plain `new PrismaClient()`
 * leaks a connection per reload until SQLite refuses to open another. The client
 * is cached on `globalThis` outside production to avoid that.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
