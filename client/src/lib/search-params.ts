/**
 * Helpers for reading filter state out of the URL.
 *
 * The leads table and the pipeline board both keep their filters in the query
 * string — shareable, bookmarkable, survives a refresh, and the back button
 * behaves the way people expect after narrowing a list. They read the same
 * parameter names in the same format, so the parsing lives here once rather
 * than being copied into each hook and drifting.
 */

/** Reads a comma-separated param, discarding any value not in `allowed`. */
export function readList<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed?: readonly T[],
): T[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    allowed ? values.filter((value): value is T => allowed.includes(value as T)) : values
  ) as T[];
}

/** Reads a single param, falling back when it is missing or not a legal value. */
export function readOne<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get(key);
  return raw && allowed.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Applies a patch to the query string, deleting anything that equals its
 * default so a clean view keeps a clean URL.
 */
export function applyFilterPatch<TState extends object>(
  current: URLSearchParams,
  patch: Partial<TState>,
  defaults: TState,
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(patch)) {
    const isDefault = JSON.stringify(value) === JSON.stringify(defaults[key as keyof TState]);
    const isEmptyList = Array.isArray(value) && value.length === 0;

    if (isDefault || isEmptyList || value === undefined) {
      next.delete(key);
    } else if (Array.isArray(value)) {
      next.set(key, value.join(','));
    } else {
      next.set(key, String(value));
    }
  }

  return next;
}
