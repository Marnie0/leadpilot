import pino from 'pino';
import { env } from './env.js';

/**
 * Pretty output locally, structured JSON in production so hosted log drains
 * (Vercel, Render, Datadog) can parse it.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  // Without this, an `err` property logs as `{}` and the stack trace is lost —
  // which is exactly how a real fault ends up looking like a blank 500.
  serializers: { err: pino.stdSerializers.err },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[redacted]',
  },
});
