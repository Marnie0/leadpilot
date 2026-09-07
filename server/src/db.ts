import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * A single PrismaClient per process.
 *
 * `globalThis` caching matters twice over: it survives tsx's hot reload in
 * development, and it lets a warm serverless instance reuse the pool instead of
 * opening a new connection on every invocation. In production the runtime URL
 * points at Neon's PgBouncer endpoint, so the per-instance pool stays at 1.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Ensures the runtime connection string carries `pgbouncer=true` when it points
 * at Neon's pooled endpoint.
 *
 * Neon's pooler is PgBouncer in transaction mode, which cannot carry prepared
 * statements across pooled connections; without this flag Prisma hits
 * "prepared statement already exists" under concurrency.
 *
 * This is applied here rather than in `.env` on purpose: `neon link`, `neon env`
 * and `neon deploy` all rewrite DATABASE_URL from the Neon API, so any flag
 * hand-added to the file is silently dropped on the next CLI run. Doing it in
 * code is idempotent and survives that.
 */
function resolveDatasourceUrl(rawUrl: string): string {
  if (!rawUrl.includes('-pooler.')) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
    return url.toString();
  } catch {
    // A malformed URL is the connection's problem to report, not ours to mask.
    return rawUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(env.DATABASE_URL),
    log: env.isDevelopment
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
  // @ts-expect-error — the `query` event is only typed when `log` is a const tuple.
  prisma.$on('query', (event: { query: string; duration: number }) => {
    if (event.duration > 200) {
      logger.debug({ duration: event.duration, query: event.query }, 'slow query');
    }
  });
}

export type { Prisma } from '@prisma/client';
