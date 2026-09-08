import { randomBytes } from 'node:crypto';
import type { AuthTokenType, Prisma, PrismaClient } from '@prisma/client';
import { AUTH_LINK_LIFETIME_HOURS } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { hashToken } from '../../lib/tokens.js';

/**
 * One-time emailed secrets, for verifying an address and resetting a password.
 *
 * ## What is stored
 *
 * Only the SHA-256. The raw token exists in the email and in the URL the user
 * clicks, and nowhere else — so read access to the database is not by itself
 * enough to take over an account. This mirrors how refresh tokens are handled
 * in `lib/tokens.ts`; there is one hashing helper for all of it rather than
 * three subtly different ones.
 *
 * ## Why issuing invalidates the previous ones
 *
 * Asking for a second reset link should make the first stop working. Otherwise
 * every request leaves a live credential behind, and a mailbox that has
 * accumulated five of them has five chances to be replayed. The most recent
 * link is the only one that works.
 */

const TTL_MS = AUTH_LINK_LIFETIME_HOURS * 60 * 60 * 1000;

/** 32 random bytes, URL-safe. Long enough that guessing is not a strategy. */
const rawToken = (): string => randomBytes(32).toString('base64url');

export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
  tx: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<string> {
  const token = rawToken();

  // Spend the previous ones rather than deleting: `usedAt` keeps the row, so a
  // replay of an older link is a recognisable event rather than a silent miss.
  await tx.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  await tx.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  return token;
}

export interface ConsumedToken {
  userId: string;
}

/**
 * Spends a token, or returns null.
 *
 * Null covers every failure — unknown, already used, expired — because the
 * caller has nothing useful to do with the distinction and the user should not
 * be told which it was. "This link is no longer valid" is the honest answer to
 * all three, and telling somebody a token *existed* but had expired confirms
 * that an account is behind it.
 *
 * The update is conditional on the row still being unspent, so two clicks on
 * the same link a millisecond apart cannot both succeed.
 */
export async function consumeAuthToken(
  token: string,
  type: AuthTokenType,
): Promise<ConsumedToken | null> {
  const tokenHash = hashToken(token);

  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.type !== type || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  return { userId: row.userId };
}

/** Drops spent and expired rows. Runs from the daily housekeeping job. */
export async function purgeExpiredAuthTokens(now = new Date()): Promise<number> {
  const { count } = await prisma.authToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return count;
}
