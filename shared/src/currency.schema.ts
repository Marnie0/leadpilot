import { z } from 'zod';
import { CURRENCIES, type Currency } from './enums.js';
import { msg } from './message.js';

/**
 * Currency, in two layers.
 *
 * **Stored money is never converted.** Every lead carries the workspace's
 * currency and its `estimatedValue` is always in that currency — see the note
 * in `createLeadSchema`. That invariant is what lets the pipeline aggregates be
 * plain `SUM()`s, and everything below is built to preserve it rather than to
 * work around it.
 *
 * **Displayed money may be.** A user can pick a *display* currency and see
 * every figure restated in it at today's rate. That is a presentation choice
 * belonging to the reader, not a change to the data: two people looking at the
 * same workspace can hold different display currencies at the same time, and
 * neither of them has edited anything.
 *
 * The one place the two layers meet is a workspace changing its base currency,
 * which really does restate stored values — see `changeCurrencySchema`.
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

export interface CurrencyChangeResultDto {
  currency: Currency;
  /** How many leads had their stored value restated. */
  converted: number;
  /** The rate applied, quoted as `to` per one `from`. */
  rate: number;
}
