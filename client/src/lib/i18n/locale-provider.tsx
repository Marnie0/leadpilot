import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Direction as RadixDirection } from 'radix-ui';
import { Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, Locale } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuth } from '@/features/auth/auth-context';
import { ensureArabicFont, getLoadedBundle, loadLocaleBundle, type LocaleBundle } from './locales';
import { createMessageRenderer, createTranslator, type Translator } from './translate';

export const LOCALE_STORAGE_KEY = 'leadpilot.locale';

/**
 * BCP 47 tags used for every `Intl` call.
 *
 * `-u-nu-latn` on Arabic forces Western digits. Arabic-Indic numerals (٤٥٦) are
 * correct for prose, but Gulf business software — invoices, banking, CRMs —
 * overwhelmingly uses Latin digits, and mixing them with the Latin currency
 * codes and `tabular-nums` column alignment this app already relies on reads as
 * a bug rather than a nicety. One place to change if a workspace disagrees.
 */
const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar-u-nu-latn',
};

export type Direction = 'ltr' | 'rtl';

const DIRECTIONS: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

interface I18nContextValue {
  locale: Locale;
  /** The BCP 47 tag to hand to `Intl` and `date-fns`. */
  intlLocale: string;
  /** The active locale's `date-fns` locale, for the formatters. */
  bundle: LocaleBundle;
  dir: Direction;
  isRtl: boolean;
  setLocale: (locale: Locale) => void;
  t: Translator;
  /** Renders a Zod message token from the shared schemas in this locale. */
  translateMessage: (message: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}

/** A stored choice wins; otherwise fall back to what the browser asks for. */
function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Blocked storage — carry on with the browser preference.
  }
  return navigator.languages?.some((tag) => tag.toLowerCase().startsWith('ar')) ? 'ar' : 'en';
}

/**
 * Owns the active language, the document direction, and both of the things a
 * component needs to render text: `t` and the `Intl` tag.
 *
 * It sits *inside* `AuthProvider` because the language is part of the user's
 * profile rather than a device setting — signing in on a second machine should
 * bring your language with you. A visitor who has not chosen one yet adopts the
 * account's; an explicit local choice always wins, and is written back to the
 * profile so it follows the user everywhere.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  /*
   * The locale whose strings are actually in memory.
   *
   * English is bundled, so it is ready on the first render and this never
   * lags behind. Arabic arrives in a dynamic chunk: until it lands, `ready`
   * still says `en`, and the app renders a bare spinner rather than a frame of
   * English text that then flips. Someone whose stored language is Arabic is
   * shown a spinner, not the wrong language.
   */
  const [ready, setReady] = useState<Locale>('en');

  /** True once this visitor has made an explicit choice on this device. */
  const hasLocalChoice = useRef<boolean>(
    (() => {
      try {
        return isLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
      } catch {
        return false;
      }
    })(),
  );

  const saveProfileLocale = useMutation({
    mutationFn: (next: Locale) => api.patch<{ user: AuthUser }>('/auth/me', { locale: next }),
    onSuccess: ({ user: updated }) => queryClient.setQueryData(queryKeys.session, updated),
    // A failed write is not worth interrupting anyone over: the language has
    // already changed on screen and is stored locally. It simply will not
    // follow them to another device until the next successful save.
    onError: () => undefined,
  });

  /*
   * Reconcile the device and the account on sign-in.
   *
   * Without a local choice, the account wins: signing in on a second machine
   * brings your language with you.
   *
   * With one, it wins — and is written back. That second half was missing, and
   * the gap was visible: someone who picked Arabic on the sign-in screen and
   * then signed into an account recorded as English got an Arabic interface
   * whose own settings page said "Language: English", and the choice never
   * followed them to another device.
   */
  useEffect(() => {
    if (!user) return;
    if (!hasLocalChoice.current) {
      setLocaleState((current) => (current === user.locale ? current : user.locale));
      return;
    }
    if (user.locale !== locale && !saveProfileLocale.isPending) saveProfileLocale.mutate(locale);
    // `saveProfileLocale` is a stable mutation object; including it would re-run
    // this on every render of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      hasLocalChoice.current = true;
      setLocaleState(next);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // The choice still applies to this session.
      }
      if (user && user.locale !== next) saveProfileLocale.mutate(next);
    },
    [user, saveProfileLocale],
  );

  /*
   * Fetch the strings for whatever language is now active.
   *
   * `loadLocaleBundle` returns synchronously when the chunk is already in
   * memory, so switching back to a language you have used before does not
   * flicker. The font is requested at the same moment for the same reason it
   * is split out at all: an English-speaking visitor should never pay for it.
   */
  useEffect(() => {
    if (locale === 'ar') ensureArabicFont();

    const result = loadLocaleBundle(locale);
    if (!(result instanceof Promise)) {
      setReady(locale);
      return;
    }

    let cancelled = false;
    void result.then(() => {
      if (!cancelled) setReady(locale);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Direction follows the *requested* language immediately: it costs nothing to
  // load and flipping it with the text would make the switch look sluggish.
  const dir = DIRECTIONS[locale];

  // The document attributes drive far more than styling: `dir` flips every
  // logical CSS property, and `lang` is what tells the browser which font to
  // pick for a glyph and how to hyphenate and speak it.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(() => {
    const bundle = getLoadedBundle(ready);
    const t = createTranslator(INTL_LOCALES[ready], bundle.dictionary);
    return {
      locale: ready,
      intlLocale: INTL_LOCALES[ready],
      bundle,
      dir,
      isRtl: dir === 'rtl',
      setLocale,
      t,
      translateMessage: createMessageRenderer(t),
    };
  }, [ready, dir, setLocale]);

  // Nothing renders until the requested language is in hand. The spinner is
  // wordless on purpose — there is no dictionary yet to word it with.
  if (ready !== locale) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background" aria-busy>
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <I18nContext.Provider value={value}>
      {/*
        Radix reads direction from context, not from the DOM. Without this a
        Select would still open its menu to the left and arrow keys inside a
        dropdown would move the wrong way in Arabic.
      */}
      <RadixDirection.DirectionProvider dir={dir}>{children}</RadixDirection.DirectionProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <LocaleProvider>');
  return context;
}

/** Shorthand for the common case of needing only the translate function. */
export function useT(): Translator {
  return useI18n().t;
}
