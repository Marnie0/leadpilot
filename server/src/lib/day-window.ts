/**
 * Day boundaries in a *reader's* timezone.
 *
 * "Overdue" and "Today" are the two words this product organises work around,
 * and both of them are questions about somebody's calendar rather than the
 * server's. Computed from `new Date()` with `setHours(0,0,0,0)`, they were
 * answered in whatever zone the process happened to run in — UTC on Vercel —
 * so a rep in Dubai opening the app at 01:00 was shown the previous day's
 * buckets until 04:00 local. Nothing about that is visible as a bug; the list
 * simply has the wrong things in it.
 *
 * The zone arrives per request as an IANA name from the browser, so this is
 * correct for a rep in Riyadh, a manager in London and the same person after
 * they fly between the two — without hard-coding a region anywhere.
 */

/** Falls back to UTC, which is at least a defensible answer for everybody. */
export const DEFAULT_TIME_ZONE = 'UTC';

/**
 * True for a zone this runtime can actually resolve.
 *
 * The value comes from a browser and is therefore untrusted input:
 * `Intl.DateTimeFormat` throws a RangeError on anything it does not recognise,
 * which would otherwise turn a stray query parameter into a 500.
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function normaliseTimeZone(zone: string | undefined): string {
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

/**
 * How far `zone` is ahead of UTC at a given instant, in milliseconds.
 *
 * Measured at the instant rather than taken from a table, so daylight saving is
 * handled by construction: the same zone returns a different answer in January
 * and July, and neither is hard-coded.
 */
function offsetAt(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  // `at` carries milliseconds the formatter drops; strip them from both sides.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant at which the current day begins in `zone`.
 *
 * Guesses UTC midnight of the local date, then corrects by the offset measured
 * at that guess. One correction is enough for every real zone: offsets move by
 * an hour at most, and never across a whole day.
 */
export function startOfDayIn(zone: string, now = new Date()): Date {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const [year, month, day] = local.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(year, month - 1, day);
  return new Date(guess - offsetAt(zone, new Date(guess)));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayWindow {
  /** Midnight that started the reader's today, as a UTC instant. */
  startOfToday: Date;
  /** The last millisecond of the reader's today. */
  endOfToday: Date;
  /** Seven days past the end of today — the "next 7 days" horizon. */
  weekEnd: Date;
}

/** Every boundary the follow-up buckets and dashboard counts need, in one call. */
export function dayWindow(zone: string, now = new Date()): DayWindow {
  const startOfToday = startOfDayIn(zone, now);
  // Adding 24 hours would be wrong on a DST changeover; the next local midnight
  // is what actually ends the day.
  const startOfTomorrow = startOfDayIn(
    zone,
    new Date(startOfToday.getTime() + DAY_MS + DAY_MS / 2),
  );
  const endOfToday = new Date(startOfTomorrow.getTime() - 1);
  return { startOfToday, endOfToday, weekEnd: new Date(endOfToday.getTime() + 7 * DAY_MS) };
}
