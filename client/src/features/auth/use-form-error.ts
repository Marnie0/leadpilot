import { useCallback, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api-client';

/**
 * Bridges API errors into a form.
 *
 * The server returns `details` keyed by field path, so per-field messages land
 * on the right input; anything without a field lands in a single form-level
 * message shown above the submit button.
 */
export function useFormError<TValues extends FieldValues>(setError: UseFormSetError<TValues>) {
  const [formError, setFormError] = useState<string | null>(null);

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
          setFormError(matchedAField ? null : error.message);
          return;
        }
        setFormError(error.message);
        return;
      }

      setFormError('Something went wrong. Please check your connection and try again.');
    },
    [setError],
  );

  const clearFormError = useCallback(() => setFormError(null), []);

  return { formError, handleError, clearFormError };
}
