import { AI_MAX_SIGNALS, AI_URGENCIES, FOLLOW_UP_CHANNELS } from '@leadpilot/shared';
import { AppError } from '../../lib/errors.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';

/**
 * The Gemini adapter.
 *
 * ## Why Gemini, and why the free tier is the right one
 *
 * Three things had to be true: free with no card (the same bar Neon and Vercel
 * were held to), strong Arabic (half this product is Arabic, and the assistant
 * *drafts a message a human will send*), and schema-enforced JSON.
 *
 * Gemini's free tier is the only one that is all three. Groq's is genuinely
 * free too, but its usable models cap at 8K tokens/minute — roughly five of
 * these calls before it throttles — and open-weight Arabic is noticeably
 * weaker. OpenRouter's `:free` pool is 50 requests *per day*, which one
 * interested visitor exhausts.
 *
 * ## The boundary this file draws
 *
 * Everything provider-shaped stops here. The service above it sees a
 * `LeadAnalysis` or an `AppError` with a code the UI can translate, and knows
 * nothing about `x-goog-api-key`, response envelopes or finish reasons. That
 * is what makes swapping providers a change to one file rather than a change
 * to the feature.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Long enough for a Flash-Lite completion, short enough that a hanging provider
 * never holds a serverless invocation to its own timeout. A user who waits ten
 * seconds and gets a retry button is better served than one who waits sixty.
 */
const TIMEOUT_MS = 20_000;

/** What the model must return. Enforced by the API, then re-checked below. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    qualityScore: { type: 'integer' },
    urgency: { type: 'string', enum: [...AI_URGENCIES] },
    rationale: { type: 'string' },
    nextAction: { type: 'string' },
    nextActionChannel: { type: 'string', enum: [...FOLLOW_UP_CHANNELS] },
    draftMessage: { type: 'string' },
    signals: { type: 'array', items: { type: 'string' }, maxItems: AI_MAX_SIGNALS },
  },
  required: [
    'summary',
    'qualityScore',
    'urgency',
    'rationale',
    'nextAction',
    'nextActionChannel',
    'draftMessage',
    'signals',
  ],
} as const;

export interface LeadAnalysis {
  summary: string;
  qualityScore: number;
  urgency: (typeof AI_URGENCIES)[number];
  rationale: string;
  nextAction: string;
  nextActionChannel: (typeof FOLLOW_UP_CHANNELS)[number];
  draftMessage: string;
  signals: string[];
}

export const PROVIDER_NAME = 'Google Gemini';

/**
 * Whether the provider's free tier trains on what is sent to it.
 *
 * Hard-coded true because it is true of the tier this deployment uses, and
 * because the settings screen states it to the person deciding whether to
 * switch the assistant on. If this is ever pointed at a paid tier or a
 * different provider, this constant is the thing to change — it is deliberately
 * not derived from the key, which cannot tell us.
 */
export const PROVIDER_TRAINS_ON_INPUT = true;

const aiUnavailable = (message: string, cause?: unknown) =>
  new AppError(503, 'AI_UNAVAILABLE', message, { cause });

/**
 * Errors from a third party, mapped onto codes the browser can say something
 * useful about.
 *
 * The mapping matters more than it looks: a 429 from Gemini and a 429 from our
 * own budget mean different things to the user ("busy, try in a minute" versus
 * "you have used today's allowance"), and collapsing them into one message
 * makes the recoverable case look permanent.
 */
function mapHttpError(status: number, body: string): AppError {
  if (status === 429) {
    return new AppError(429, 'AI_RATE_LIMITED', 'The assistant is busy. Try again in a moment.');
  }
  if (status === 401 || status === 403) {
    // The operator's problem, not the user's — but the user still needs a
    // screen that explains itself, so it surfaces as "unavailable" rather than
    // as an authorisation failure they cannot act on.
    logger.error({ status, body }, 'AI provider rejected our credentials');
    return aiUnavailable('The assistant is not available right now.');
  }
  if (status >= 500) return aiUnavailable('The assistant is temporarily unavailable.');
  logger.error({ status, body }, 'AI provider rejected the request');
  return aiUnavailable('The assistant could not process this lead.');
}

/**
 * Pulls the model's text out of the response envelope.
 *
 * The Interactions API answers with a `steps` array, and only the
 * `model_output` steps carry the answer — a reasoning model also emits
 * `thought` steps, which must not be concatenated into the JSON we are about to
 * parse. Verified against the live endpoint rather than taken from the docs,
 * whose example shows an `output_text` field this model does not return.
 *
 * The two fallbacks below cost nothing and cover the older `output` and
 * `candidates[]` envelopes, so a provider-side rollback does not take the
 * feature down with it.
 */
function extractText(payload: unknown): string | null {
  const root = payload as Record<string, unknown>;

  const textOf = (parts: unknown): string =>
    Array.isArray(parts)
      ? parts
          .map((part) => {
            const p = part as Record<string, unknown>;
            return typeof p?.text === 'string' ? p.text : '';
          })
          .join('')
      : '';

  const steps = root?.steps;
  if (Array.isArray(steps)) {
    const fromSteps = steps
      .filter((step) => (step as Record<string, unknown>)?.type === 'model_output')
      .map((step) => textOf((step as Record<string, unknown>)?.content))
      .join('');
    if (fromSteps.trim()) return fromSteps;
  }

  if (typeof root?.output_text === 'string' && root.output_text.trim()) return root.output_text;

  const fromOutput = textOf(root?.output);
  if (fromOutput.trim()) return fromOutput;

  const candidates = root?.candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const fromCandidate = textOf(content?.parts);
  return fromCandidate.trim() ? fromCandidate : null;
}

const clampScore = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

const asString = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * Re-validates what came back.
 *
 * The API enforces the schema, so this is belt-and-braces — but it is cheap
 * belt-and-braces guarding a value that gets written to the database and shown
 * as a factual assessment. A score of `NaN` or a `null` draft rendering as the
 * word "null" on a lead page is the failure this prevents.
 */
function parseAnalysis(text: string): LeadAnalysis {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Some models wrap JSON in a ```json fence despite the mime type.
    const fenced = /\{[\s\S]*\}/.exec(text);
    if (!fenced)
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'The assistant returned no usable analysis.');
    try {
      raw = JSON.parse(fenced[0]);
    } catch (cause) {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'The assistant returned no usable analysis.', {
        cause,
      });
    }
  }

  const value = raw as Record<string, unknown>;
  const urgency = AI_URGENCIES.includes(value.urgency as never)
    ? (value.urgency as LeadAnalysis['urgency'])
    : 'MEDIUM';
  const channel = FOLLOW_UP_CHANNELS.includes(value.nextActionChannel as never)
    ? (value.nextActionChannel as LeadAnalysis['nextActionChannel'])
    : 'CALL';

  const analysis: LeadAnalysis = {
    summary: asString(value.summary, 1200),
    qualityScore: clampScore(value.qualityScore),
    urgency,
    rationale: asString(value.rationale, 1200),
    nextAction: asString(value.nextAction, 400),
    nextActionChannel: channel,
    draftMessage: asString(value.draftMessage, 3000),
    signals: Array.isArray(value.signals)
      ? value.signals
          .map((signal) => asString(signal, 80))
          .filter(Boolean)
          .slice(0, AI_MAX_SIGNALS)
      : [],
  };

  // The three fields the card is built around. Missing prose is a failed
  // analysis, not a partial one — rendering an empty summary as though the
  // model had judged the lead unremarkable would be a lie.
  if (!analysis.summary || !analysis.nextAction || !analysis.draftMessage) {
    throw new AppError(
      502,
      'AI_INVALID_RESPONSE',
      'The assistant returned an incomplete analysis.',
    );
  }
  return analysis;
}

/** Calls the provider. Throws an `AppError` with a translatable code, or returns. */
export async function analyse(prompt: string): Promise<{ analysis: LeadAnalysis; model: string }> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'The assistant is not configured on this server.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: env.AI_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: RESPONSE_SCHEMA,
        },
        generation_config: {
          // Low but not zero: the draft message should not read like a form
          // letter, and the scores should not wobble between runs.
          temperature: 0.3,
          max_output_tokens: 1600,
        },
      }),
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    logger.warn({ err: cause }, aborted ? 'AI request timed out' : 'AI request failed');
    throw aiUnavailable(
      aborted ? 'The assistant took too long to answer.' : 'Could not reach the assistant.',
      cause,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw mapHttpError(response.status, (await response.text().catch(() => '')).slice(0, 500));
  }

  const payload: unknown = await response.json().catch(() => null);

  // A 200 does not by itself mean the model answered: an interaction can come
  // back `failed` or still running. Treating either as a parse failure would
  // report a provider problem as a malformed analysis.
  const status = (payload as Record<string, unknown>)?.status;
  if (typeof status === 'string' && status !== 'completed') {
    logger.warn({ status }, 'AI interaction did not complete');
    throw aiUnavailable('The assistant could not finish this analysis.');
  }

  const text = extractText(payload);
  if (!text) {
    logger.error({ payload }, 'AI response carried no text');
    throw new AppError(502, 'AI_INVALID_RESPONSE', 'The assistant returned no usable analysis.');
  }

  return { analysis: parseAnalysis(text), model: env.AI_MODEL };
}
