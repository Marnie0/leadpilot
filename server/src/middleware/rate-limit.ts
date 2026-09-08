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
  limit: env.SIGNUP_RATE_LIMIT,
});

/**
 * Accepting an invitation — creating an account too, but not open signup.
 *
 * It gets its own, much larger budget because the two are not the same risk.
 * Open signup is reachable by anyone; accepting requires a single-use secret
 * that an owner or admin deliberately issued, which is stronger anti-abuse than
 * any IP counter.
 *
 * Sharing the signup budget was actively wrong: a company onboarding its team
 * from one office address is a single IP, and the sixth person to click their
 * invitation would have been told to try again later.
 */
export const inviteLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: env.INVITE_RATE_LIMIT,
});

/**
 * Endpoints whose authorisation *is* an unguessable token: confirming an
 * address, resetting a password.
 *
 * They used to share `authLimiter`, which is keyed on IP **plus the email in
 * the body** — and these carry no email, so the key silently collapsed to the
 * IP alone. Ten attempts per quarter hour then had to cover everybody behind
 * one address: an office NAT, a mobile carrier, a school. The eleventh person
 * to confirm their email that afternoon would have been told to try later.
 *
 * A generous IP budget is the right shape here because the token is doing the
 * real work: 32 random bytes is not something anybody guesses, whatever the
 * request rate. This exists to bound noise, not to stop an attack.
 */
export const tokenLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 60,
});

/**
 * Starting a demo clones ~530 rows, so it is the most expensive thing an
 * unauthenticated caller can trigger. Budget is per IP.
 */
export const demoLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 10,
});

/** A generous backstop for the rest of the API. */
export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 300,
});
