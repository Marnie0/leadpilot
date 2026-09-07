import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { prisma } from './db.js';

/**
 * Standalone entrypoint: a long-running HTTP server.
 *
 * This is what `npm run dev` uses and what a Render / Fly / VPS deployment would
 * run. The Vercel deployment imports `createApp` from `app.ts` instead and never
 * executes this file.
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `LeadPilot API listening on http://localhost:${env.PORT}`,
  );
});

/** Drain in-flight requests and close the database pool before exiting. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});
