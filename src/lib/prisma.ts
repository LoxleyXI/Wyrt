/**
 * Prisma Client Singleton for Wyrt
 *
 * Prevents multiple instances during development hot reloading.
 */

import { PrismaClient } from '../generated/prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

// Extend global type to include our Prisma client
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Create singleton instance
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// In development, store on global to prevent hot reload issues
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

/**
 * Helper to safely disconnect
 */
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    console.log('[Prisma] Disconnected');
  } catch (error) {
    console.error('[Prisma] Error disconnecting:', error);
  }
}

/**
 * Helper to test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[Prisma] Connection test failed:', error);
    return false;
  }
}
