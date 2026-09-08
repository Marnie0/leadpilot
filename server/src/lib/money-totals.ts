import {
  CURRENCIES,
  buildMoneyTotal,
  convertCurrency,
  emptyMoneyTotal,
  type Currency,
  type CurrencyAmountDto,
  type MoneyTotalDto,
} from '@leadpilot/shared';
import { getRates } from '../modules/fx/fx.service.js';

/**
 * Turning per-currency database rows into totals a screen can show.
 *
 * ## The problem this solves
 *
 * A workspace may quote leads in several currencies, so `SUM("estimatedValue")`
 * over a filtered set is arithmetic between different units. Every aggregate in
 * the product therefore groups by `currency` first, and the grouped rows come
 * through here to become either a breakdown, a converted total, or — as the
 * DTOs actually carry — both at once.
 *
 * ## Why rates are resolved once per request
 *
 * `getRates()` is memoised and falls back through cache and compiled-in figures,
 * so it is cheap, but it is still one place that can be slow or absent. A
 * `MoneyContext` is built once at the top of a service call and threaded through
 * every total it produces, which means one screenful of figures is always drawn
 * at one set of rates. Fetching per total would let two numbers on the same card
 * disagree by a rounding of a rate that moved between them.
 */

/** Narrows an arbitrary string to a currency the product can convert. */
export function asCurrency(code: string | null | undefined): Currency | null {
  return CURRENCIES.includes(code as Currency) ? (code as Currency) : null;
}

export interface MoneyContext {
  /** What single-figure totals are expressed in. */
  target: Currency;
  /** Undefined when rates could not be resolved; totals then stay unconverted. */
  rates: Record<Currency, number> | undefined;
}

/**
 * Resolves the currency a reader's totals should be drawn in.
 *
 * `requested` is the `display` query parameter — the reader's own choice, which
 * the browser knows and the server does not. An unrecognised or absent value
 * falls back to the workspace's currency rather than failing: a total drawn in
 * the workspace currency is labelled as such and is still true, whereas a 422
 * on a dashboard is a blank screen.
 */
export async function moneyContext(
  requested: string | undefined,
  workspaceCurrency: string,
): Promise<MoneyContext> {
  const base = asCurrency(workspaceCurrency) ?? 'USD';
  const target = asCurrency(requested) ?? base;

  // No conversion is needed for a workspace that only ever holds one currency
  // *and* is being read in it — but that is not knowable here without another
  // query, and `getRates()` is memoised, so this stays simple and always
  // correct rather than clever and occasionally wrong.
  try {
    const { rates } = await getRates();
    return { target, rates };
  } catch {
    // Rates are a nice-to-have for a breakdown and load-bearing only for the
    // converted figure. Losing them should degrade the total, not the screen.
    return { target, rates: undefined };
  }
}

/** Row shape every grouped aggregate reduces to before coming through here. */
export interface GroupedAmount {
  currency: string;
  amount: number;
}

const normalise = (rows: Iterable<GroupedAmount>, fallback: Currency): CurrencyAmountDto[] => {
  const out: CurrencyAmountDto[] = [];
  for (const row of rows) {
    out.push({ currency: asCurrency(row.currency) ?? fallback, amount: row.amount });
  }
  return out;
};

/** Builds one total from grouped rows. */
export function totalFrom(rows: Iterable<GroupedAmount>, context: MoneyContext): MoneyTotalDto {
  return buildMoneyTotal(normalise(rows, context.target), context.target, context.rates);
}

/** The empty total, in the reader's currency. */
export function zeroTotal(context: MoneyContext): MoneyTotalDto {
  return emptyMoneyTotal(context.target);
}

/**
 * Converts a single grouped set to one number.
 *
 * For the places a breakdown would not help — a point on a trend line, one
 * source's share of attribution — where the honest thing is still to convert
 * each currency separately and add, rather than to sum mixed units and label
 * the result with whichever currency happened to be first.
 */
export function convertedSum(rows: Iterable<GroupedAmount>, context: MoneyContext): number {
  let total = 0;
  for (const { currency, amount } of normalise(rows, context.target)) {
    total += context.rates
      ? convertCurrency(amount, currency, context.target, context.rates)
      : amount;
  }
  return total;
}

/**
 * Every currency present in a set of grouped rows, for the view switcher.
 *
 * Takes only the currency, so it can be handed a raw `groupBy` result without
 * first mapping it into `GroupedAmount`s.
 */
export function currenciesIn(
  rows: Iterable<{ currency: string }>,
  context: MoneyContext,
): Currency[] {
  const seen = new Set<Currency>();
  for (const row of rows) seen.add(asCurrency(row.currency) ?? context.target);
  return [...seen].sort();
}
