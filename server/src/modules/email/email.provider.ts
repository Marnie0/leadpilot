import { env } from '../../env.js';
import { logger } from '../../logger.js';

/**
 * The Resend adapter.
 *
 * ## The one rule
 *
 * **Sending email never fails the thing that triggered it.** Signing up,
 * inviting a colleague and asking for a password reset all continue to work
 * when the mail provider is down, rate limited, or simply not configured. This
 * function therefore reports success or failure and throws nothing; callers do
 * not wrap it in try/catch because there is nothing to catch.
 *
 * That is not laziness about errors — it is the correct trade for this product.
 * Every flow behind an email has a path that does not need the email: an
 * unverified account still signs in, an invite link can be copied from the
 * screen, and a forgotten password is still recoverable once mail is working.
 * Failing the request would turn a provider outage into "you cannot create an
 * account", which is strictly worse than an address that stays unconfirmed.
 *
 * ## Unconfigured is a first-class state
 *
 * With no API key the message is logged at info instead of sent. Local
 * development then needs no third party, and the tests can read the link out of
 * the log rather than out of an inbox.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/** Short: a slow mail provider must not hold a request open. */
const TIMEOUT_MS = 8_000;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** What this message is, for the log line. Never sent to the recipient. */
  kind: string;
}

export interface SendResult {
  /** True when the provider accepted it, or when it was logged in dev. */
  ok: boolean;
  /** Set when a real send was attempted and refused. */
  error?: string;
  /** False when there is no key and the message was only logged. */
  sent: boolean;
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  if (!env.RESEND_API_KEY) {
    // The body is deliberately included: in development the verification and
    // reset links are only obtainable from here.
    logger.info(
      { kind: message.kind, to: message.to, subject: message.subject, text: message.text },
      'email not sent — no RESEND_API_KEY, logging instead',
    );
    return { ok: true, sent: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      /*
       * Logged at warn, not error, and deliberately not retried.
       *
       * The overwhelmingly common failure here is Resend's shared sender
       * refusing a recipient that is not the account owner — a configuration
       * fact, not an incident, and one no retry can fix. A verified domain in
       * `EMAIL_FROM` makes it go away.
       */
      logger.warn(
        { kind: message.kind, status: response.status, detail },
        'email provider refused the message',
      );
      return { ok: false, sent: false, error: `${response.status}` };
    }

    logger.info({ kind: message.kind }, 'email sent');
    return { ok: true, sent: true };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    logger.warn({ kind: message.kind, err: error }, aborted ? 'email timed out' : 'email failed');
    return { ok: false, sent: false, error: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
