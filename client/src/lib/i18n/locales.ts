import type { Locale as DateFnsLocale } from 'date-fns';
import { enGB } from 'date-fns/locale/en-GB';
import type { Locale } from '@leadpilot/shared';
import { en } from './en';
import type { Dictionary } from './translate';

/**
 * Everything a locale needs at runtime: its strings and its date locale.
 *
 * English ships in the main bundle because it is the fallback and most visitors
 * never leave it. Arabic — its dictionary plus the `date-fns` locale, together
 * about 40 kB — is a dynamic import, so an English-speaking visitor never
 * downloads a word of it. The Arabic webfont is fetched on the same condition
 * (see `ensureArabicFont`), which is the larger saving of the two.
 */
export interface LocaleBundle {
  dictionary: Dictionary;
  dateLocale: DateFnsLocale;
}

const ENGLISH: LocaleBundle = { dictionary: en, dateLocale: enGB };

/**
 * Bundles already in memory, keyed by locale.
 *
 * Exported because `ErrorBoundary` needs to render a crash screen without being
 * able to `await` anything, and without pulling Arabic back into the main
 * bundle by importing it. It reads whatever is loaded and falls back to English
 * — which is the right answer anyway for a crash that happened before the
 * language finished loading.
 */
const loaded = new Map<Locale, LocaleBundle>([['en', ENGLISH]]);

export function getLoadedBundle(locale: Locale): LocaleBundle {
  return loaded.get(locale) ?? ENGLISH;
}

/** In-flight loads, so two callers never fetch the same chunk twice. */
const pending = new Map<Locale, Promise<LocaleBundle>>();

export function loadLocaleBundle(locale: Locale): LocaleBundle | Promise<LocaleBundle> {
  const ready = loaded.get(locale);
  if (ready) return ready;

  let promise = pending.get(locale);
  if (!promise) {
    promise = import('./ar-bundle').then((module) => {
      loaded.set(locale, module.arBundle);
      pending.delete(locale);
      return module.arBundle;
    });
    pending.set(locale, promise);
  }
  return promise;
}

/** Google Fonts stylesheet for the Arabic face, kept out of the initial HTML. */
const ARABIC_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';

/**
 * Requests the Arabic webfont, once.
 *
 * The same link is injected by the bootstrap script in `index.html` when the
 * stored locale is already Arabic, so a returning Arabic reader starts the font
 * download in the document head rather than waiting for React. This covers the
 * other case: someone switching to Arabic mid-session.
 */
export function ensureArabicFont(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-font="arabic"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ARABIC_FONT_HREF;
  link.dataset.font = 'arabic';
  document.head.appendChild(link);
}
