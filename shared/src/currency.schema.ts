import { z } from 'zod';
import { CURRENCIES, type Currency } from './enums.js';
import { msg } from './message.js';

/**
 * Currency, in two layers.
 *
 * **Stored money is never converted.** Each lead carries the currency its value
 * was actually quoted in, and `estimatedValue` is always a figure in *that*
 * currency. A workspace may hold leads in as many currencies as it does
 * business in; nothing in the product rewrites one into another behind the
 * reader's back.
 *
 * **Displayed money may be.** A reader picks a display currency and a view —
 * every figure restated into one currency at today's rate, or each currency
 * kept apart and totalled separately. Both are presentation choices belonging
 * to the reader: two people looking at the same workspace can hold different
 * ones at the same time, and neither of them has edited anything.
 *
 * The one place the two layers meet is a workspace restating its stored values
 * into a single currency, which really does rewrite them — see
 * `changeCurrencySchema`.
 *
 * ## Why aggregates group rather than convert row by row
 *
 * A total over mixed currencies cannot be a plain `SUM()`. It could be done by
 * converting every row on the way out, but that is a per-row conversion on a
 * table that grows without bound. Grouping by currency first bounds the work by
 * the number of currencies the product supports — a handful — and hands back
 * both answers from one query: the per-currency figures a breakdown needs, and
 * the single converted total, which is those same figures converted once each
 * and added. The two can never disagree, because one is derived from the other.
 */

export const currencySchema = z.enum(CURRENCIES, {
  error: msg('validation.currency'),
});

/** `null` means "follow the workspace" rather than "no currency". */
export const displayCurrencySchema = currencySchema.nullable();

/**
 * The pivot every stored rate hangs off.
 *
 * One pivot rather than a full N×N matrix: a table of pairs drifts, because
 * `USD→AED` and `AED→USD` are fetched at different moments and stop being each
 * other's reciprocal. Cross rates derived from a single snapshot cannot.
 */
export const RATE_BASE = 'USD' satisfies Currency;

export interface ExchangeRateDto {
  /** Units of this currency per one `RATE_BASE`. `USD` is always exactly 1. */
  [code: string]: number;
}

export interface FxRatesDto {
  base: Currency;
  rates: Record<Currency, number>;
  /** The day the rates are quoted for, ISO date. Shown to the user, not decorative. */
  asOf: string;
  /**
   * Where the numbers came from. `fallback` means every live source was
   * unreachable and these are the figures compiled into the build — still
   * usable for an indicative conversion, but the UI says so rather than
   * presenting stale rates as current.
   */
  source: 'live' | 'cache' | 'fallback';
}

/**
 * Converts between two currencies through the pivot.
 *
 * Returns `amount` unchanged when the two currencies match, so a workspace that
 * never touches this feature is never subjected to a float round-trip.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>,
): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

/**
 * Changing a workspace's base currency.
 *
 * This is the destructive half of the feature and it is gated accordingly. Each
 * lead's stored `estimatedValue` is genuinely restated at the current rate,
 * because the alternative — relabelling without converting, or letting two
 * currencies coexist in one workspace — makes every total on the dashboard a
 * number that means nothing.
 *
 * `confirm` is required rather than implied: the client shows how many leads
 * are about to be rewritten and at what rate, and this field is how it reports
 * that the person saw that sentence.
 */
export const changeCurrencySchema = z.object({
  currency: currencySchema,
  confirm: z.literal(true, { error: msg('validation.confirmRequired') }),
});
export type ChangeCurrencyInput = z.infer<typeof changeCurrencySchema>;

/**
 * How a reader wants mixed-currency totals presented.
 *
 * `CONVERTED` restates everything into one currency at today's rate — one
 * number, comparable, and slightly wrong at the edges because a rate is a
 * moment's opinion. `BREAKDOWN` keeps each currency apart and adds nothing
 * across them — several numbers, all exactly true.
 *
 * Neither is the right default for everybody, which is why it is a setting
 * rather than a decision the product makes. A workspace trading in one currency
 * never sees the difference: both render the same single figure.
 */
export const MONEY_VIEWS = ['CONVERTED', 'BREAKDOWN'] as const;
export type MoneyView = (typeof MONEY_VIEWS)[number];

/** One currency's share of a total. */
export interface CurrencyAmountDto {
  currency: Currency;
  amount: number;
}

/**
 * A sum of money that may span currencies.
 *
 * Carries both readings at once — the per-currency figures and the single
 * converted total — so switching the view is an instant re-render rather than
 * a refetch, and so the UI can never show a converted total it has no
 * breakdown for.
 */
export interface MoneyTotalDto {
  /**
   * Per-currency sums, largest first, containing only currencies actually
   * present. Empty when there is no money at all, which is different from one
   * currency holding zero.
   */
  byCurrency: CurrencyAmountDto[];
  /**
   * Everything above, converted into `currency` and added — or **null** when
   * that cannot honestly be computed.
   *
   * Null happens when exchange rates could not be resolved at all *and* more
   * than one currency is present. It is deliberately not a number: the obvious
   * fallback is to add the raw amounts and label the result with one currency,
   * which is precisely the bug this whole shape exists to prevent, and it would
   * be invisible — a plausible number that is simply wrong. Making it null
   * forces every reader to decide what to show, and they all show the
   * breakdown, which is still exactly true without any rate at all.
   */
  converted: number | null;
  /** The currency `converted` is expressed in. */
  currency: Currency;
  /**
   * True when more than one currency contributed.
   *
   * The UI reads this rather than `byCurrency.length > 1` so that "this total
   * is a blend" is one idea with one name, and so a breakdown control can hide
   * itself on the workspaces where it would only ever show one row.
   */
  mixed: boolean;
}

/** An empty total, for the many aggregates that can legitimately have no rows. */
export function emptyMoneyTotal(currency: Currency): MoneyTotalDto {
  return { byCurrency: [], converted: 0, currency, mixed: false };
}

/**
 * The figure to use where a single number is unavoidable — a chart point, a
 * sort key, a forecast.
 *
 * Falls back to the largest single currency rather than to zero, because a
 * chart plotting zero for a workspace with money in it is a lie of a different
 * kind. Callers that can show a breakdown instead should do that.
 */
export function comparableAmount(total: MoneyTotalDto): number {
  if (total.converted !== null) return total.converted;
  return total.byCurrency.reduce((max, entry) => Math.max(max, entry.amount), 0);
}

/**
 * Builds a total from per-currency sums.
 *
 * Shared rather than server-only because the client assembles totals too — the
 * board sums its columns to a footer, and doing that by re-adding `converted`
 * figures would drop the breakdown on the floor.
 */
export function buildMoneyTotal(
  amounts: Iterable<CurrencyAmountDto>,
  target: Currency,
  rates: Record<Currency, number> | undefined,
): MoneyTotalDto {
  // Callers pass grouped rows, so a currency appearing at all means leads exist
  // in it — a zero row therefore says "leads worth nothing yet", which is worth
  // showing, and is why nothing is filtered out here.
  const sums = new Map<Currency, number>();
  for (const { currency, amount } of amounts) {
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  }

  const byCurrency = [...sums.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));

  const mixed = byCurrency.length > 1;

  /*
   * With no rates, a mixed total has no honest single figure. Adding the raw
   * amounts would produce a plausible number in the wrong units — the exact
   * failure this shape exists to prevent — so it reports null instead and the
   * UI shows the breakdown, which needs no rate to be true.
   *
   * A single-currency total needs no conversion when it is already in the
   * target, and when it is not, it is in the same position as a mixed one.
   */
  const canConvert = rates !== undefined || !mixed;
  const converted =
    canConvert && rates
      ? byCurrency.reduce(
          (total, entry) => total + convertCurrency(entry.amount, entry.currency, target, rates),
          0,
        )
      : mixed
        ? null
        : (byCurrency[0]?.amount ?? 0);

  return {
    byCurrency,
    converted,
    // Without rates a single-currency total is reported in its own currency,
    // not in a target it was never converted into.
    currency: rates || byCurrency.length === 0 ? target : (byCurrency[0]?.currency ?? target),
    mixed,
  };
}

export interface CurrencyChangeResultDto {
  currency: Currency;
  /** How many leads had their stored value restated. */
  converted: number;
  /** The rate applied, quoted as `to` per one `from`. */
  rate: number;
}
