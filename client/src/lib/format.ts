import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isTomorrow,
  isValid,
  parseISO,
} from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ar as arDates } from 'date-fns/locale/ar';
import { enGB as enDates } from 'date-fns/locale/en-GB';
import type { Locale } from '@leadpilot/shared';
import type { Translator } from './i18n/translate';

/** Parses an API date string, returning `null` rather than an Invalid Date. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** Two-letter initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string)[0]}${(parts[parts.length - 1] as string)[0]}`.toUpperCase();
}

/** Formats a phone number for a `tel:` href by stripping presentation characters. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export interface DueDescriptor {
  label: string;
  /** Drives the badge colour: overdue is red, today amber, the rest neutral. */
  tone: 'overdue' | 'today' | 'soon' | 'later' | 'none';
  daysUntil: number | null;
}

const DATE_LOCALES: Record<Locale, DateFnsLocale> = { en: enDates, ar: arDates };

export interface Formatters {
  currency: (amount: number, currency: string, options?: { precise?: boolean }) => string;
  number: (value: number) => string;
  percent: (value: number, fractionDigits?: number) => string;
  date: (value: string | Date | null | undefined) => string;
  dateTime: (value: string | Date | null | undefined) => string;
  /** "4 hours ago" / "منذ 4 ساعات". */
  relative: (value: string | Date | null | undefined) => string;
  /** Bare duration with no direction — "23 hours". */
  distance: (value: string | Date | null | undefined) => string;
  dueDate: (value: string | Date | null | undefined) => DueDescriptor;
  /** Axis label for a dashboard trend bucket, from its UTC start. */
  trendLabel: (bucketIso: string, bucket: 'week' | 'month') => string;
}

/**
 * Builds every formatter the UI needs, bound to one locale.
 *
 * Formatting is locale work, not string work: Arabic wants Arabic month names,
 * a currency symbol on the other side of the number, and its own plural rules
 * for "overdue by N days". Building these once per locale change also avoids
 * re-constructing `Intl` objects — which are expensive — on every table row.
 *
 * `dueDate` needs the translator as well as the locale, because its phrasing is
 * ours ("Overdue by 3 days") rather than something `Intl` can produce.
 */
export function createFormatters(intlLocale: string, locale: Locale, t: Translator): Formatters {
  const dateLocale = DATE_LOCALES[locale];
  const dateOptions = { locale: dateLocale };

  const numberFormat = new Intl.NumberFormat(intlLocale);
  const trendWeek = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const trendMonth = new Intl.DateTimeFormat(intlLocale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Currency formatters are cached per currency code: a workspace has exactly
  // one, so this is a map of size one in practice, built once.
  const compactCurrency = new Map<string, Intl.NumberFormat>();
  const exactCurrency = new Map<string, Intl.NumberFormat>();

  const formatters: Formatters = {
    /**
     * Large pipeline figures are abbreviated (1.2M) so table columns and stat
     * cards stay readable; `precise` opts into the full number for detail views.
     */
    currency(amount, currency, options = {}) {
      if (!options.precise && Math.abs(amount) >= 10_000) {
        let formatter = compactCurrency.get(currency);
        if (!formatter) {
          formatter = new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 1,
          });
          compactCurrency.set(currency, formatter);
        }
        return formatter.format(amount);
      }

      // Whole amounts drop the decimals; fractional ones keep two. The cache key
      // carries that choice so the two variants never overwrite each other.
      const whole = amount % 1 === 0;
      const key = `${currency}:${whole ? 0 : 2}`;
      let formatter = exactCurrency.get(key);
      if (!formatter) {
        formatter = new Intl.NumberFormat(intlLocale, {
          style: 'currency',
          currency,
          maximumFractionDigits: whole ? 0 : 2,
        });
        exactCurrency.set(key, formatter);
      }
      return formatter.format(amount);
    },

    number: (value) => numberFormat.format(value),

    percent: (value, fractionDigits = 0) =>
      t('common.percent', { value: value.toFixed(fractionDigits) }),

    /** `12 Mar` for this year, `12 Mar 2024` otherwise. */
    date(value) {
      const date = value instanceof Date ? value : parseDate(value);
      if (!date) return t('common.dash');
      return format(date, isThisYear(date) ? 'd MMM' : 'd MMM yyyy', dateOptions);
    },

    dateTime(value) {
      const date = value instanceof Date ? value : parseDate(value);
      if (!date) return t('common.dash');
      return format(date, isThisYear(date) ? 'd MMM, HH:mm' : 'd MMM yyyy, HH:mm', dateOptions);
    },

    relative(value) {
      const date = value instanceof Date ? value : parseDate(value);
      if (!date) return t('common.dash');
      if (Math.abs(Date.now() - date.getTime()) / 1000 < 60) return t('relative.justNow');
      return formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale });
    },

    distance(value) {
      const date = value instanceof Date ? value : parseDate(value);
      if (!date) return t('common.dash');
      return formatDistanceToNowStrict(date, { locale: dateLocale });
    },

    /**
     * Turns a follow-up date into the phrase and urgency the UI shows.
     * Comparison is by calendar day, so "tomorrow at 09:00" reads as tomorrow
     * even when it is less than 24 hours away.
     */
    dueDate(value) {
      const date = value instanceof Date ? value : parseDate(value);
      if (!date) return { label: t('due.none'), tone: 'none', daysUntil: null };

      const daysUntil = differenceInCalendarDays(date, new Date());
      const time = format(date, 'HH:mm', dateOptions);

      if (daysUntil < 0) {
        return {
          label: t('due.overdue', { count: Math.abs(daysUntil) }),
          tone: 'overdue',
          daysUntil,
        };
      }
      if (isToday(date)) return { label: t('due.today', { time }), tone: 'today', daysUntil };
      if (isTomorrow(date)) return { label: t('due.tomorrow', { time }), tone: 'soon', daysUntil };
      if (daysUntil <= 7) {
        return { label: format(date, 'EEEE, HH:mm', dateOptions), tone: 'soon', daysUntil };
      }
      return { label: formatters.date(date), tone: 'later', daysUntil };
    },

    trendLabel: (bucketIso, bucket) =>
      (bucket === 'month' ? trendMonth : trendWeek).format(new Date(bucketIso)),
  };

  return formatters;
}
