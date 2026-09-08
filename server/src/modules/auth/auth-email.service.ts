import { createHash } from 'node:crypto';
import type { Locale } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { sendEmail } from '../email/email.provider.js';
import { appLink, buildEmail } from '../email/email.templates.js';
import { issueAuthToken } from './auth-tokens.service.js';

/**
 * The email side of authentication.
 *
 * Kept apart from `auth.service.ts` so the account logic and the mail logic can
 * be read separately — and so the one rule that matters here is visible in one
 * place: **nothing in this file throws.** A mail failure must never fail the
 * signup, reset or invitation that triggered it.
 */

/**
 * An address in the logs, without the address.
 *
 * Enough to correlate repeated attempts on the same target across log lines,
 * not enough to recover the address from a leaked log. The alternative — the
 * plain email — puts personal data in a stream that is retained longer and read
 * more casually than the database it came from.
 */
export function hashedForLog(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12);
}

export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
  workspace: string,
  locale: Locale,
): Promise<void> {
  const token = await issueAuthToken(userId, 'EMAIL_VERIFICATION');
  const link = appLink(`/verify-email?token=${encodeURIComponent(token)}`);
  const message = buildEmail('verify', locale, link, { name, workspace });
  await sendEmail({ to: email, kind: 'verify', ...message });
}

/**
 * Sent when somebody signs up with an address that already has an account.
 *
 * Carries no token and creates nothing — the link goes to the sign-in screen.
 * Its only job is to make sure the person who owns the address finds out,
 * since the API deliberately tells the caller nothing.
 */
export async function sendExistingAccountNotice(
  email: string,
  name: string,
  locale: Locale,
): Promise<void> {
  const message = buildEmail('verifyExisting', locale, appLink('/login'), { name });
  await sendEmail({ to: email, kind: 'verifyExisting', ...message });
}

/**
 * Password reset, for an address that may or may not exist.
 *
 * Both branches send something. The unknown-address branch is not decoration:
 * somebody who typed the wrong address otherwise sits waiting for a mail that
 * is never coming, and somebody whose address is being probed gets to know
 * about it. Neither branch tells the *caller* which happened.
 */
export async function sendPasswordReset(email: string, locale: Locale): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, locale: true, isActive: true },
  });

  if (!user || !user.isActive) {
    logger.info({ email: hashedForLog(email) }, 'password reset requested for unknown address');
    const message = buildEmail('resetUnknown', locale, appLink('/signup'), {});
    await sendEmail({ to: email, kind: 'resetUnknown', ...message });
    return;
  }

  const token = await issueAuthToken(user.id, 'PASSWORD_RESET');
  const link = appLink(`/reset-password?token=${encodeURIComponent(token)}`);
  const message = buildEmail('reset', user.locale ?? locale, link, { name: user.name });
  await sendEmail({ to: email, kind: 'reset', ...message });
  logger.info({ userId: user.id }, 'password reset link issued');
}

/** True when the deployment can actually deliver, for the UI to be honest. */
export const emailConfigured = (): boolean => env.emailConfigured;
