import { useMemo } from 'react';
import { createFormatters, type Formatters } from '@/lib/format';
import { useI18n } from './locale-provider';

export { LocaleProvider, useI18n, useT, type Direction } from './locale-provider';
export type { TranslationKey, StaticKey, Translator, PlaceholdersOf } from './translate';
export type { Formatters } from '@/lib/format';
export { en } from './en';
export { ar } from './ar';
export { createTranslator } from './translate';

/**
 * Number, currency and date formatters bound to the active locale.
 *
 * Memoised on the locale rather than rebuilt per render: `Intl` constructors
 * are among the more expensive things a component can do, and a table of fifty
 * rows would otherwise build a formatter per cell.
 */
export function useFormat(): Formatters {
  const { intlLocale, locale, t } = useI18n();
  return useMemo(() => createFormatters(intlLocale, locale, t), [intlLocale, locale, t]);
}
