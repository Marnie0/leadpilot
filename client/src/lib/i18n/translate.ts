import { interpolate, parseMessageToken } from '@leadpilot/shared';
import type { MessageParams } from '@leadpilot/shared';
import { en } from './en';

/**
 * The translation core.
 *
 * There is no i18n library here, and that is a deliberate choice. What this app
 * needs from one is a lookup, `{placeholder}` interpolation and correct plural
 * selection — all three of which the platform already provides via `Intl`. What
 * it gets in exchange for the sixty lines below is the thing a runtime library
 * cannot offer: **the compiler checks the keys**. A typo, a key deleted from
 * English but still used in a component, or an Arabic dictionary that has
 * drifted out of sync are all build failures rather than a `leads.titel` shown
 * to a user in production.
 */

/**
 * The plural categories `Intl.PluralRules` can return.
 *
 * English uses two of them; Arabic uses all six, which is exactly why plural
 * selection is delegated to `Intl` instead of the usual `count === 1 ? a : b`.
 * "3 leads" and "11 leads" are different words in Arabic.
 */
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralSuffix = `_${PluralCategory}`;

/** The English dictionary is the source of truth for the key list. */
export type EnglishDictionary = typeof en;
export type RawKey = keyof EnglishDictionary & string;

/** Stems of every plural family, found by looking for the mandatory `_other`. */
type PluralStem = {
  [K in RawKey]: K extends `${infer Stem}_other` ? Stem : never;
}[RawKey];

/**
 * What a component may pass to `t()`: plain keys unchanged, and plural families
 * addressed by their stem (`t('leads.count', { count })`, never `leads.count_one`).
 */
export type TranslationKey = Exclude<RawKey, `${PluralStem}${PluralSuffix}`> | PluralStem;

/** The English string a key resolves to, used to derive its placeholders. */
type SourceString<K extends TranslationKey> = K extends RawKey
  ? EnglishDictionary[K]
  : `${K}_other` extends RawKey
    ? EnglishDictionary[`${K}_other`]
    : never;

/** Pulls `{name}` placeholders out of a literal string type. */
type Placeholder<S> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholder<Rest>
  : never;

/** The placeholder names a key's string contains — used by the rich renderer. */
export type PlaceholdersOf<K extends TranslationKey> = Placeholder<SourceString<K>>;

type PlaceholderParams<K extends TranslationKey> = [Placeholder<SourceString<K>>] extends [never]
  ? unknown
  : Record<Placeholder<SourceString<K>>, string | number>;

type CountParam<K extends TranslationKey> = K extends PluralStem ? { count: number } : unknown;

type Params<K extends TranslationKey> = PlaceholderParams<K> & CountParam<K>;

/**
 * Makes the params argument required when the string needs one and forbidden
 * when it does not — so a missing interpolation value is a compile error rather
 * than a literal `{name}` rendered on screen.
 */
type Args<K extends TranslationKey> = keyof Params<K> extends never ? [] : [params: Params<K>];

/**
 * A locale's dictionary.
 *
 * Every English key is required, which is what makes a missing Arabic string a
 * build failure. On top of that, *any* key may carry plural forms — not only
 * the families English happens to declare. That asymmetry is the normal case
 * rather than an edge one: "must be 128 characters or fewer" needs a single
 * form in English and four in Arabic, and there is no reason the English
 * dictionary should have to know that.
 */
export type Dictionary = { [K in RawKey]: string } & Partial<
  // `RawKey` covers a locale adding forms to a key English keeps singular;
  // `PluralStem` covers adding the missing categories to a family English
  // already declares as `_one` / `_other`.
  Record<`${RawKey | PluralStem}${PluralSuffix}`, string>
>;

/**
 * Keys whose string carries no placeholders and is not a plural family.
 *
 * These are the only ones that can be held in a lookup table — a column
 * definition, a nav row — and called as a bare `t(key)`. Typing such a table as
 * `StaticKey` makes "you put a key here that needs a `{count}`" a compile error
 * at the table, where it can be fixed, rather than at the call site, where the
 * value is gone.
 */
export type StaticKey = {
  [K in TranslationKey]: keyof Params<K> extends never ? K : never;
}[TranslationKey];

export type Translator = <K extends TranslationKey>(key: K, ...args: Args<K>) => string;

/**
 * A `t` that takes any string.
 *
 * The typed signature cannot express "this key came from runtime data", which
 * is exactly the case for an API error code or a Zod message token. Widening is
 * confined to `asLoose` so the escape hatch is one greppable name rather than a
 * cast scattered through the code, and the keys it is used with are still
 * guaranteed to exist — by `Dictionary` requiring them.
 */
export type LooseTranslator = (key: string) => string;

export const asLoose = (t: Translator): LooseTranslator => t as unknown as LooseTranslator;

/**
 * Builds the `t` function for a locale.
 *
 * Lookup order for a plural family is the `Intl` category, then `_other`, then
 * the English dictionary. That last hop means a half-translated dictionary
 * degrades to English rather than to a raw key — but it cannot happen by
 * accident, because `Dictionary` would not compile.
 */
export function createTranslator(locale: string, dictionary: Dictionary): Translator {
  const pluralRules = new Intl.PluralRules(locale);
  const lookup = (key: string): string | undefined =>
    (dictionary as Record<string, string | undefined>)[key] ??
    (en as Record<string, string | undefined>)[key];

  return <K extends TranslationKey>(key: K, ...args: Args<K>): string => {
    const params = args[0] as (MessageParams & { count?: number }) | undefined;

    let resolved: string | undefined;
    if (params && typeof params.count === 'number') {
      const category = pluralRules.select(params.count) as PluralCategory;
      resolved = lookup(`${key}_${category}`) ?? lookup(`${key}_other`);
    }
    resolved ??= lookup(key);

    // A key with no string anywhere is shown as the key itself. It is ugly on
    // purpose: silent empty text is a bug that survives review.
    return interpolate(resolved ?? key, params);
  };
}

/**
 * Renders a Zod validation message in the active locale.
 *
 * The shared schemas emit tokens rather than prose (see `shared/src/message.ts`),
 * so the same schema that guards the API also produces Arabic text in the
 * browser. Anything that is not a token — a message from a library, say — falls
 * through unchanged.
 */
export function createMessageRenderer(t: Translator) {
  // Widened so the token's runtime params can be passed straight through: `t`
  // then does plural selection on `count` as well as interpolation, which is
  // what lets "must be at least 2 characters" become "حرفين" rather than the
  // literal-but-wrong "2 أحرف".
  const translate = t as unknown as (key: string, params?: MessageParams) => string;

  return (message: string): string => {
    const token = parseMessageToken(message);
    if (!token) return message;

    const params: MessageParams = { ...token.params };
    if (typeof params.fieldKey === 'string') {
      params.field = translate(params.fieldKey);
      delete params.fieldKey;
    }

    return translate(token.key, params);
  };
}
