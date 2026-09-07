import { ar as dateLocale } from 'date-fns/locale/ar';
import { ar as dictionary } from './ar';
import type { LocaleBundle } from './locales';

/**
 * The Arabic chunk.
 *
 * Its only job is to pull the dictionary and the `date-fns` locale into one
 * dynamic import, so switching to Arabic is a single network request rather
 * than two — and so nothing here is reachable from the main bundle's import
 * graph.
 */
export const arBundle: LocaleBundle = { dictionary, dateLocale };
