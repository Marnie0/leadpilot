import { useCallback } from 'react';
import type { FieldErrors, FieldValues, Resolver, ResolverResult } from 'react-hook-form';
import { useI18n } from './locale-provider';

/**
 * Recursively rewrites every `message` in a react-hook-form error tree.
 *
 * The tree is nested (`{ address: { city: { message } } }`) and also holds
 * non-text keys like `ref` and `type`, so this walks it rather than mapping
 * over a flat list. Objects are rebuilt instead of mutated, because the result
 * goes straight into React state.
 */
function translateErrors(errors: unknown, translate: (message: string) => string): unknown {
  if (Array.isArray(errors)) {
    return errors.map((entry) => translateErrors(entry, translate));
  }
  if (errors === null || typeof errors !== 'object') return errors;

  const source = errors as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'message' && typeof value === 'string') {
      result[key] = translate(value);
    } else if (key === 'ref' || key === 'type') {
      // `ref` is a live DOM node and `type` is the issue code — neither is text.
      result[key] = value;
    } else {
      result[key] = translateErrors(value, translate);
    }
  }

  return result;
}

/**
 * Wraps a resolver so the shared schemas' message tokens come out in the active
 * language.
 *
 * The schemas in `@leadpilot/shared` guard the same shapes on the server, so
 * they cannot hard-code English prose; they emit tokens instead (see
 * `shared/src/message.ts`). This is the single place that turns one back into
 * something a person reads, which means every form in the app gets translated
 * validation without knowing anything about how it works.
 *
 * It takes the built resolver rather than the schema so the call site keeps
 * `zodResolver`'s own inference — the three-generic form the lead and follow-up
 * forms rely on, where the form holds the schema's input shape and `onSubmit`
 * receives its parsed output.
 *
 * @example
 * const form = useForm({ resolver: useLocalizedResolver(zodResolver(loginSchema)) });
 */
export function useLocalizedResolver<TFieldValues extends FieldValues, TContext, TOutput>(
  resolver: Resolver<TFieldValues, TContext, TOutput>,
): Resolver<TFieldValues, TContext, TOutput> {
  const { translateMessage } = useI18n();

  return useCallback(
    async (values, context, options) => {
      const result = await resolver(values, context, options);
      if (!result.errors || Object.keys(result.errors).length === 0) return result;

      return {
        ...result,
        errors: translateErrors(result.errors, translateMessage) as FieldErrors<TFieldValues>,
      } as ResolverResult<TFieldValues, TOutput>;
    },
    [resolver, translateMessage],
  );
}
