import { CURRENCIES, RATE_BASE, type Currency, type FxRatesDto } from '@leadpilot/shared';
import { prisma } from '../../db.js';
import { logger } from '../../logger.js';

/**
 * Foreign-exchange rates.
 *
 * Three tiers, in order, and the response says which one answered:
 *
 *  1. **live** — fetched from the upstream feed when what we hold is a day old.
 *  2. **cache** — the last rates we successfully stored. Serving these when the
 *     feed is unreachable is the whole reason they are in the database: a
 *     currency switcher that breaks because someone else's API is down is worse
 *     than one quoting yesterday's rate, as long as it says "yesterday".
 *  3. **fallback** — figures compiled into the build, for a workspace whose
 *     very first request happens while the feed is down. Marked as such so the
 *     UI can label the conversion indicative rather than current.
 *
 * There is no scheduled job. Rates refresh lazily on the first request after
 * they go stale, which on serverless is the only kind of schedule that actually
 * runs — and a rate nobody asked for is a rate nobody needed.
 */

/** exchangerate-api's free endpoint: no key, no quota, daily updates. */
const FEED_URL = `https://open.er-api.com/v6/latest/${RATE_BASE}`;
const FEED_TIMEOUT_MS = 4_000;

/**
 * How old stored rates may get before a request goes and refreshes them.
 * The feed publishes once a day; 20 hours means the first caller after a
 * publication picks it up without every caller racing to.
 */
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;

/**
 * In-process memo. A warm serverless instance serves many requests, and none of
 * them needs its own database round-trip for a number that changes daily.
 */
const MEMO_TTL_MS = 5 * 60 * 1000;
let memo: { value: FxRatesDto; expiresAt: number } | null = null;

/**
 * Last-resort rates, quoted per one USD.
 *
 * Deliberately checked in with the date they were taken rather than left to a
 * migration: this table's job is to answer when nothing else can, which
 * includes a database that has never been seeded.
 */
const FALLBACK_ASOF = '2026-09-08';
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.8604,
  GBP: 0.7386,
  SAR: 3.75,
  AED: 3.6725,
  EGP: 50.919,
  QAR: 3.64,
  KWD: 0.3086,
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

interface FeedResponse {
  result?: string;
  base_code?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
}

/**
 * Pulls the feed and narrows it to the currencies this product supports.
 *
 * A missing or non-finite quote drops the whole response rather than the one
 * currency: a partial table would silently leave some workspaces converting at
 * the fallback rate while others used today's, and no screen would say so.
 */
async function fetchLive(): Promise<{ rates: Record<Currency, number>; asOf: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const response = await fetch(FEED_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`feed responded ${response.status}`);

    const body = (await response.json()) as FeedResponse;
    if (body.result !== 'success' || !body.rates) throw new Error('feed returned no rates');

    const rates = {} as Record<Currency, number>;
    for (const code of CURRENCIES) {
      const rate = body.rates[code];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`feed is missing a usable rate for ${code}`);
      }
      rates[code] = rate;
    }

    const asOf = body.time_last_update_unix
      ? isoDate(new Date(body.time_last_update_unix * 1000))
      : isoDate(new Date());
    return { rates, asOf };
  } catch (error) {
    logger.warn({ err: error }, 'FX feed unavailable, falling back to stored rates');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readStored(): Promise<{
  rates: Record<Currency, number>;
  asOf: Date;
  fetchedAt: Date;
} | null> {
  const rows = await prisma.exchangeRate.findMany({ where: { base: RATE_BASE } });
  if (rows.length === 0) return null;

  const byQuote = new Map(rows.map((row) => [row.quote, row]));
  const rates = {} as Record<Currency, number>;
  for (const code of CURRENCIES) {
    const row = byQuote.get(code);
    // A currency added to the product after the last refresh: the stored table
    // is incomplete, so treat it as absent rather than quoting seven of eight.
    if (!row) return null;
    rates[code] = row.rate.toNumber();
  }

  const newest = rows.reduce(
    (latest, row) => (row.fetchedAt > latest ? row.fetchedAt : latest),
    rows[0]!.fetchedAt,
  );
  return { rates, asOf: rows[0]!.asOf, fetchedAt: newest };
}

async function store(rates: Record<Currency, number>, asOf: string): Promise<void> {
  const asOfDate = new Date(`${asOf}T00:00:00.000Z`);
  const fetchedAt = new Date();
  await prisma.$transaction(
    CURRENCIES.map((quote) =>
      prisma.exchangeRate.upsert({
        where: { base_quote: { base: RATE_BASE, quote } },
        create: { base: RATE_BASE, quote, rate: rates[quote], asOf: asOfDate, fetchedAt },
        update: { rate: rates[quote], asOf: asOfDate, fetchedAt },
      }),
    ),
  );
}

/** The current rate table, from whichever tier can supply one. */
export async function getRates(): Promise<FxRatesDto> {
  if (memo && memo.expiresAt > Date.now()) return memo.value;

  const stored = await readStored();
  const isFresh = stored !== null && Date.now() - stored.fetchedAt.getTime() < STALE_AFTER_MS;

  let result: FxRatesDto;
  if (isFresh) {
    result = { base: RATE_BASE, rates: stored.rates, asOf: isoDate(stored.asOf), source: 'cache' };
  } else {
    const live = await fetchLive();
    if (live) {
      // Persisting must not fail the request: a rate we cannot cache is still a
      // rate we can answer with.
      await store(live.rates, live.asOf).catch((error: unknown) =>
        logger.warn({ err: error }, 'Could not persist FX rates'),
      );
      result = { base: RATE_BASE, rates: live.rates, asOf: live.asOf, source: 'live' };
    } else if (stored) {
      result = {
        base: RATE_BASE,
        rates: stored.rates,
        asOf: isoDate(stored.asOf),
        source: 'cache',
      };
    } else {
      result = { base: RATE_BASE, rates: FALLBACK_RATES, asOf: FALLBACK_ASOF, source: 'fallback' };
    }
  }

  memo = { value: result, expiresAt: Date.now() + MEMO_TTL_MS };
  return result;
}

/** Drops the in-process memo. Used by tests and by the currency-change flow. */
export function clearRateMemo(): void {
  memo = null;
}
