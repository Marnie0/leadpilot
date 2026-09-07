import { useCallback } from 'react';
import { ApiError } from '@/lib/api-client';
import { en } from './en';
import { useI18n } from './locale-provider';
import { asLoose } from './translate';

/**
 * Turns anything thrown by a request into a sentence in the active language.
 *
 * The API answers in English — it is a public contract and has no business
 * guessing at a caller's language — but it also carries a stable `code` on
 * every error. Translating by that code is what lets the browser say
 * "البريد الإلكتروني أو كلمة المرور غير صحيحة" for a failure the server
 * described as "Incorrect email or password".
 *
 * Codes with no translation fall back to the server's own message. That is a
 * deliberate ordering: the untranslated cases are guards against states the UI
 * already prevents (moving a lead you do not own, opening a record that has
 * been deleted), and a specific English sentence helps more than a generic
 * translated one. Anything users meet routinely has a code in the dictionary.
 */
export function useApiErrorMessage(): (error: unknown) => string {
  const { t } = useI18n();

  return useCallback(
    (error: unknown): string => {
      if (!(error instanceof ApiError)) return t('common.somethingWentWrong');

      const key = `apiError.${error.code}`;
      if (key in en) return asLoose(t)(key);

      return error.message || t('common.somethingWentWrong');
    },
    [t],
  );
}
