import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../env.js';

const shared = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  // Disabled in tests so suites are not throttled by their own throughput.
  skip: () => env.isTest,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
  },
};

/**
 * Credential endpoints get a tight, email-scoped budget so one attacker cannot
 * spray a password across many accounts from a single address.
 *
 * Note for the serverless deployment: this store is per-instance and resets on
 * cold start, so treat it as friction rather than a hard guarantee. A shared
 * Redis store is the upgrade if this ever handles real traffic.
 */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    // ipKeyGenerator normalises IPv6 addresses to a /64 subnet.
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
});

/** Signup is rarer still, and rate-limited purely by address. */
export const signupLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

/** A generous backstop for the rest of the API. */
export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 300,
});
