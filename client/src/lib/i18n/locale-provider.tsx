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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, Locale } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useAuth } from '@/features/auth/auth-context';
import { ar } from './ar';
import { en } from './en';
import {
  createMessageRenderer,
  createTranslator,
  type Dictionary,
  type Translator,
} from './translate';

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

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export type Direction = 'ltr' | 'rtl';

const DIRECTIONS: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

interface I18nContextValue {
  locale: Locale;
  /** The BCP 47 tag to hand to `Intl` and `date-fns`. */
  intlLocale: string;
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

  // Adopt the account's language on sign-in, unless this device has its own.
  useEffect(() => {
    if (!user || hasLocalChoice.current) return;
    setLocaleState((current) => (current === user.locale ? current : user.locale));
  }, [user]);

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
    const t = createTranslator(INTL_LOCALES[locale], DICTIONARIES[locale]);
    return {
      locale,
      intlLocale: INTL_LOCALES[locale],
      dir,
      isRtl: dir === 'rtl',
      setLocale,
      t,
      translateMessage: createMessageRenderer(t),
    };
  }, [locale, dir, setLocale]);

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
