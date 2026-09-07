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

/** Parses an API date string, returning `null` rather than an Invalid Date. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/**
 * Compact money formatting.
 * Large pipeline figures are abbreviated (1.2M) so table columns and stat cards
 * stay readable; `precise` opts into the full number for detail views.
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  options: { precise?: boolean; locale?: string } = {},
): string {
  const locale = options.locale ?? 'en-US';

  if (!options.precise && Math.abs(amount) >= 10_000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** `12 Mar` for this year, `12 Mar 2024` otherwise. */
export function formatDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '—';
  return format(date, isThisYear(date) ? 'd MMM' : 'd MMM yyyy');
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '—';
  return format(date, isThisYear(date) ? "d MMM 'at' HH:mm" : "d MMM yyyy 'at' HH:mm");
}

/** `just now`, `4 hours ago`, `2 months ago`. */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '—';
  const seconds = Math.abs(Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return 'just now';
  return `${formatDistanceToNowStrict(date)} ago`;
}

export interface DueDescriptor {
  label: string;
  /** Drives the badge colour: overdue is red, today amber, the rest neutral. */
  tone: 'overdue' | 'today' | 'soon' | 'later' | 'none';
  daysUntil: number | null;
}

/**
 * Turns a follow-up date into the phrase and urgency the UI shows.
 * Comparison is by calendar day, so "tomorrow at 09:00" reads as tomorrow even
 * when it is less than 24 hours away.
 */
export function describeDueDate(value: string | Date | null | undefined): DueDescriptor {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return { label: 'No follow-up', tone: 'none', daysUntil: null };

  const daysUntil = differenceInCalendarDays(date, new Date());

  if (daysUntil < 0) {
    const overdueBy = Math.abs(daysUntil);
    return {
      label: overdueBy === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueBy} days`,
      tone: 'overdue',
      daysUntil,
    };
  }
  if (isToday(date)) return { label: `Today, ${format(date, 'HH:mm')}`, tone: 'today', daysUntil };
  if (isTomorrow(date))
    return { label: `Tomorrow, ${format(date, 'HH:mm')}`, tone: 'soon', daysUntil };
  if (daysUntil <= 7) return { label: format(date, 'EEEE, HH:mm'), tone: 'soon', daysUntil };

  return { label: formatDate(date), tone: 'later', daysUntil };
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
