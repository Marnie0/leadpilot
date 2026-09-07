import { Fragment, useCallback, type ReactNode } from 'react';
import { useI18n } from './locale-provider';
import { asLoose, type PlaceholdersOf, type TranslationKey } from './translate';

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Substitutes React nodes into a translated template.
 *
 * This exists because word order is not a translation detail. "Layla moved the
 * lead from New to Won" puts the actor first; the Arabic puts the verb first
 * and the actor second. Building the sentence by concatenating fragments in
 * English order — `<strong>{actor}</strong> moved the lead from …` — produces
 * grammatical nonsense in Arabic no matter how good the individual words are.
 * So the whole sentence is one translatable string, and the parts that need
 * markup are dropped into it wherever that language happens to put them.
 */
function fill(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PLACEHOLDER.lastIndex = 0;
  while ((match = PLACEHOLDER.exec(template)) !== null) {
    if (match.index > lastIndex) parts.push(template.slice(lastIndex, match.index));

    const name = match[1] as string;
    // An unknown placeholder is left visible rather than dropped: a blank in
    // the middle of a sentence is far harder to notice in review.
    parts.push(name in values ? values[name] : match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < template.length) parts.push(template.slice(lastIndex));

  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

/**
 * `t`, but the interpolated values may be React nodes.
 *
 * Placeholder names are still checked against the English string, so a renamed
 * placeholder is a compile error here exactly as it is for plain `t`.
 */
export function useRichT() {
  const { t } = useI18n();

  return useCallback(
    <K extends TranslationKey>(key: K, values: Record<PlaceholdersOf<K>, ReactNode>): ReactNode => {
      // Called without params, `t` returns the template with its placeholders
      // still in it — which is exactly what has to be filled with nodes.
      const template = asLoose(t)(key);
      return fill(template, values as Record<string, ReactNode>);
    },
    [t],
  );
}
