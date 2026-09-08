/**
 * The reader's IANA timezone, as the browser reports it.
 *
 * Sent with any query that has a "today" or "overdue" notion in it, because
 * those are questions about the reader's calendar rather than the server's. Not
 * a stored preference and not guessed from a region: a rep who flies from Dubai
 * to London gets London's answer on landing, without setting anything.
 *
 * Resolved once — it cannot change without a page load, and calling into `Intl`
 * on every query key would be needless work for a constant.
 */
export const TIME_ZONE: string | undefined = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    // An environment without a resolvable zone falls through to the server's
    // UTC default rather than failing the request.
    return undefined;
  }
})();

/** Spread into a query's params. Empty when the browser could not say. */
export const timeZoneParam: { tz?: string } = TIME_ZONE ? { tz: TIME_ZONE } : {};
