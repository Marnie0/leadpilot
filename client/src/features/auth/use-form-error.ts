import { useCallback, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api-client';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/**
 * Bridges API errors into a form.
 *
 * The server returns `details` keyed by field path, so per-field messages land
 * on the right input; anything without a field lands in a single form-level
 * message shown above the submit button.
 *
 * Field messages arrive as English prose — the API resolves its own message
 * tokens before responding — but in practice a user never reaches them: the
 * same shared schema validates in the browser first, in their language. What
 * does reach them is the form-level failure (wrong password, email taken), and
 * that is translated here from the error's stable code.
 */
export function useFormError<TValues extends FieldValues>(setError: UseFormSetError<TValues>) {
  const [formError, setFormError] = useState<string | null>(null);
  const describe = useApiErrorMessage();

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.details) {
          let matchedAField = false;
          for (const [field, messages] of Object.entries(error.details)) {
            const message = messages[0];
            if (!message || field === '_root') continue;
            setError(field as Path<TValues>, { type: 'server', message });
            matchedAField = true;
          }
          // Only fall back to the banner when nothing attached to an input,
          // so the user never sees the same message twice.
          setFormError(matchedAField ? null : describe(error));
          return;
        }
        setFormError(describe(error));
        return;
      }

      setFormError(describe(error));
    },
    [setError, describe],
  );

  const clearFormError = useCallback(() => setFormError(null), []);

  return { formError, handleError, clearFormError };
}
