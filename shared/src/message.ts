/**
 * Machine-readable validation messages.
 *
 * Zod only lets a schema carry a plain string, but these schemas are parsed on
 * both sides of the wire and the browser has to render them in English *or*
 * Arabic. So instead of prose, a schema emits a token — a sentinel-prefixed
 * JSON payload naming a message key and its parameters — and each side renders
 * it in whatever language it speaks:
 *
 *   - the **server** resolves every token to English before responding, so the
 *     public API contract stays plain readable English for any consumer;
 *   - the **browser** resolves it against the active locale, which is what a
 *     user actually sees, because the same schemas validate the form before it
 *     is ever submitted.
 *
 * The sentinel makes a token impossible to confuse with a literal message, so
 * anything unrecognised — Zod's own built-in wording, a third-party refinement
 * — falls through untouched.
 */

const SENTINEL = '␄i18n:';

export type MessageParams = Record<string, string | number>;

export interface MessageToken {
  key: string;
  params?: MessageParams;
}

/**
 * Builds a validation message token.
 *
 * `params.fieldKey` is special: it names another key rather than carrying text,
 * and the renderer resolves it into `{field}` first. That is what lets
 * "Customer name is required" translate as a whole sentence instead of leaving
 * an English noun stranded inside an Arabic one.
 */
export function msg(key: MessageKey, params?: MessageParams): string {
  return SENTINEL + JSON.stringify(params ? [key, params] : [key]);
}

export function isMessageToken(value: string): boolean {
  return value.startsWith(SENTINEL);
}

/** Parses a token back into its key and params, or `null` if it is plain text. */
export function parseMessageToken(value: string): MessageToken | null {
  if (!isMessageToken(value)) return null;
  try {
    const [key, params] = JSON.parse(value.slice(SENTINEL.length)) as [string, MessageParams?];
    return params ? { key, params } : { key };
  } catch {
    return null;
  }
}

/** Substitutes `{name}` placeholders. Unknown placeholders are left in place. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Renders a message — token or plain text — using `lookup` to resolve keys.
 *
 * `lookup` returns `undefined` for a key it does not know, in which case the
 * key itself is rendered. That is deliberately visible: a missing translation
 * should look wrong in review rather than silently render as an empty string.
 */
export function renderMessage(value: string, lookup: (key: string) => string | undefined): string {
  const token = parseMessageToken(value);
  if (!token) return value;

  const params: MessageParams = { ...token.params };
  if (typeof params.fieldKey === 'string') {
    params.field = lookup(params.fieldKey) ?? params.fieldKey;
    delete params.fieldKey;
  }

  return interpolate(lookup(token.key) ?? token.key, params);
}

/**
 * Every validation string the schemas can emit, in English.
 *
 * This is the source of truth for the key list: the client's Arabic dictionary
 * is typed against `MessageKey`, so adding a rule here without translating it
 * is a compile error rather than an English string leaking into an Arabic form.
 */
export const VALIDATION_EN = {
  'validation.required': '{field} is required',
  // Every number a message counts something with is named `count`, so the
  // browser's plural selection can find it. Arabic has six plural categories
  // where English has one form; see the client's `ar.ts`.
  'validation.tooLong': '{field} must be {count} characters or fewer',
  'validation.maxLength': 'Must be {count} characters or fewer',
  'validation.minLength': '{field} must be at least {count} characters',
  'validation.email': 'Enter a valid email address',
  'validation.emailRequired': 'Email is required',
  'validation.phone': 'Enter a valid phone number',
  'validation.phoneTooLong': 'Phone number is too long',
  'validation.date': 'Enter a valid date',
  'validation.dateRequired': 'A date is required',
  'validation.number': 'Enter a number',
  'validation.negative': 'Value cannot be negative',
  'validation.tooLarge': 'Value is unrealistically large',
  'validation.passwordRequired': 'Password is required',
  'validation.passwordMin': 'Password must be at least {count} characters',
  'validation.passwordMax': 'Password must be {count} characters or fewer',
  'validation.passwordLetter': 'Password must contain at least one letter',
  'validation.passwordNumber': 'Password must contain at least one number',
  'validation.passwordConfirm': 'Please confirm your password',
  'validation.passwordMismatch': 'Passwords do not match',
  'validation.currentPasswordRequired': 'Current password is required',
  'validation.tagsMax': 'Up to {count} tags',
  'validation.noChanges': 'No changes supplied',
  'validation.requiredShort': 'Required',
  'validation.currency': 'Choose a supported currency',
  'validation.confirmRequired': 'Please confirm before continuing',
  'validation.confirmName': 'Type the customer’s name to confirm',

  'field.name': 'Your name',
  'field.companyName': 'Company name',
  'field.workspaceName': 'Workspace name',
  'field.customerName': 'Customer name',
  'field.requestedService': 'Requested service',
  'field.title': 'Title',
  'field.tag': 'Tag',
  'field.note': 'Note',
  'field.value': 'Value',
} as const;

export type MessageKey = keyof typeof VALIDATION_EN;

/** Renders a schema message in English — what the API always sends. */
export const renderMessageEn = (value: string): string =>
  renderMessage(value, (key) => VALIDATION_EN[key as MessageKey]);
