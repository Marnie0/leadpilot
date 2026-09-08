import { useQuery } from '@tanstack/react-query';
import { CURRENCIES, convertCurrency, type Currency, type FxRatesDto } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useFormat, useT } from '@/lib/i18n';

/** Narrows a stored currency string to one the product knows how to convert. */
export function asCurrency(code: string | null | undefined): Currency | null {
  return CURRENCIES.includes(code as Currency) ? (code as Currency) : null;
}

/**
 * Reference rates.
 *
 * `enabled` is passed by the caller rather than assumed, because the common
 * case — a reader on the workspace's own currency — needs no rates at all, and
 * fetching them anyway would put a third-party round-trip behind every screen
 * for a conversion nobody asked for.
 */
export function useFxRates(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.fxRates,
    queryFn: () => api.get<FxRatesDto>('/fx/rates'),
    enabled,
    // Rates are published once a day; refetching within the hour cannot change
    // an answer, and a stale rate is better than a spinner over a number.
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

export interface Money {
  /**
   * Formats an amount, converting it into the reader's display currency.
   *
   * `from` is the currency the amount is actually stored in — normally the
   * workspace's. Passing it explicitly rather than assuming keeps the one case
   * that matters honest: a figure that has not been converted must not be
   * labelled as though it had.
   */
  format: (amount: number, from: string, options?: { precise?: boolean }) => string;
  /** The currency figures are being shown in. */
  displayCurrency: Currency;
  /** The workspace's own currency — what the numbers are stored in. */
  baseCurrency: Currency;
  /** True when the two differ, so the UI can say the figures were converted. */
  isConverted: boolean;
  /** True while a requested conversion is still waiting on rates. */
  isLoadingRates: boolean;
  /** Publication date of the rates in use, ISO, or null when none are needed. */
  asOf: string | null;
  /** `fallback` means the live feed was unreachable — worth saying out loud. */
  source: FxRatesDto['source'] | null;
}

/**
 * The money formatter, bound to the reader's display currency.
 *
 * Conversion is a *display* concern and stops at the edge of this hook: no
 * stored amount is ever written back in a converted form, and two people
 * looking at the same workspace in different currencies are looking at the same
 * data. The one exception is a workspace changing its base currency, which is
 * a deliberate, confirmed rewrite handled in the settings screen.
 *
 * When rates are wanted but have not arrived — or could not be fetched at all —
 * amounts fall back to their original currency rather than to an unconverted
 * number wearing the wrong symbol. A reader briefly seeing "AED 250,000" is
 * told the truth; "$250,000" would not be.
 */
export function useMoney(): Money {
  const user = useCurrentUser();
  const format = useFormat();

  const baseCurrency = asCurrency(user.organization.defaultCurrency) ?? 'USD';
  const preferred = asCurrency(user.displayCurrency);
  const wantsConversion = preferred !== null && preferred !== baseCurrency;

  const ratesQuery = useFxRates(wantsConversion);
  const rates = ratesQuery.data?.rates;
  const canConvert = wantsConversion && rates !== undefined;
  const displayCurrency = canConvert && preferred ? preferred : baseCurrency;

  return {
    format: (amount, from, options) => {
      const source = asCurrency(from) ?? baseCurrency;
      if (!canConvert || !rates) return format.currency(amount, source, options);
      return format.currency(
        convertCurrency(amount, source, displayCurrency, rates),
        displayCurrency,
        options,
      );
    },
    displayCurrency,
    baseCurrency,
    isConverted: canConvert,
    isLoadingRates: wantsConversion && ratesQuery.isLoading,
    asOf: canConvert ? (ratesQuery.data?.asOf ?? null) : null,
    source: canConvert ? (ratesQuery.data?.source ?? null) : null,
  };
}

/**
 * The sentence that goes under a screenful of converted figures.
 *
 * Returns `null` when nothing was converted, so a caller can render it
 * unconditionally and have it disappear when it would be a lie.
 */
export function useConversionNote(money: Money): string | null {
  const t = useT();
  const format = useFormat();
  if (!money.isConverted) return null;

  const asOf = money.asOf ? t('currency.ratesAsOf', { date: format.date(money.asOf) }) : null;
  const converted = t('currency.convertedFrom', { from: money.baseCurrency });
  if (money.source === 'fallback') return `${converted} · ${t('currency.ratesIndicative')}`;
  return asOf ? `${converted} · ${asOf}` : converted;
}
