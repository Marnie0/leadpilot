import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Load .env from the server workspace, then fall back to a repo-root .env so a
// single file at the top level works for `npm run dev` from anywhere.
loadEnv();
loadEnv({ path: new URL('../../.env', import.meta.url).pathname });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL is required' }),
  /**
   * Unpooled connection used by `prisma migrate`.
   * `DATABASE_URL_UNPOOLED` is the name `neon link` and the Vercel/Neon
   * integration write, so it is accepted as an alias before falling back to
   * DATABASE_URL.
   */
  DIRECT_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),

  /**
   * Signing secrets. Two distinct keys so a leaked access secret cannot be used
   * to mint refresh tokens. Generate with:
   *   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   */
  JWT_ACCESS_SECRET: z.string().min(32, {
    message: 'JWT_ACCESS_SECRET must be at least 32 characters',
  }),
  JWT_REFRESH_SECRET: z.string().min(32, {
    message: 'JWT_REFRESH_SECRET must be at least 32 characters',
  }),

  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  /**
   * Comma-separated list of origins allowed to send credentialed requests.
   * Empty in production, where the client is served from the same origin.
   */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Set to `false` only when running the API over plain HTTP in development. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /**
   * Bearer token Vercel Cron presents when calling the sandbox reaper.
   * Unset closes the endpoint entirely — it never defaults to open.
   */
  CRON_SECRET: z.string().min(16).optional(),

  /**
   * Returns the real error message and stack to the client in production too.
   * Off by default: on a public deployment that is information disclosure.
   * Useful on a portfolio demo where you are the only one reading it.
   */
  EXPOSE_ERROR_DETAILS: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail loudly at boot rather than at the first request that needs the value.
  throw new Error(`Invalid environment configuration:\n${issues}\n`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  DIRECT_URL: raw.DIRECT_URL ?? raw.DATABASE_URL_UNPOOLED ?? raw.DATABASE_URL,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  /** Secure cookies by default in production; overridable for local HTTP. */
  cookieSecure: raw.COOKIE_SECURE ?? raw.NODE_ENV === 'production',
  /** Non-production always shows details; production requires the opt-in. */
  exposeErrorDetails: raw.EXPOSE_ERROR_DETAILS || raw.NODE_ENV !== 'production',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
