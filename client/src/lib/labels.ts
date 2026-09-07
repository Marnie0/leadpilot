import type { LeadPriority, Locale } from '@leadpilot/shared';
import type { StaticKey, Translator } from './i18n/translate';

/**
 * Display helpers for values that come back from the API.
 *
 * Most enums need no helper at all: their labels live in the dictionary under a
 * matching prefix, so a component writes `` t(`source.${lead.source}`) `` and
 * the compiler checks that every member of the union has a translation. What is
 * left here is the two cases that cannot work that way, plus the one map that
 * is about styling rather than language.
 */

/** Tailwind classes per priority — muted for low, loud for urgent. */
export const PRIORITY_STYLES: Record<LeadPriority, string> = {
  LOW: 'bg-muted text-muted-foreground border-transparent',
  MEDIUM: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  HIGH: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  URGENT: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25',
};

/**
 * A pipeline stage's name in the active language.
 *
 * Stage names are per-tenant data, not UI copy — a workspace can rename
 * "Proposal" to "Quote sent" — so they come from the row rather than the
 * dictionary. Every stage carries both languages; `nameAr` falls back to `name`
 * so a stage added in English still renders rather than disappearing.
 */
export function stageName(stage: { name: string; nameAr?: string }, locale: Locale): string {
  if (locale !== 'ar') return stage.name;
  return stage.nameAr && stage.nameAr.length > 0 ? stage.nameAr : stage.name;
}

/** The set of lead fields a FIELD_UPDATED activity entry can name. */
const LEAD_FIELDS = [
  'customerName',
  'company',
  'email',
  'phone',
  'requestedService',
  'estimatedValue',
  'priority',
  'source',
] as const;

/**
 * Human label for the field named in a FIELD_UPDATED activity entry.
 *
 * `metadata.field` is a free-form string on the wire, so it is matched against
 * the known set rather than interpolated into a key — an unrecognised value
 * must not produce `leadField.somethingElse` on screen.
 */
export function leadFieldLabel(t: Translator, field: string | undefined): string {
  const known = LEAD_FIELDS.find((candidate) => candidate === field);
  if (!known) return field ?? t('activity.aField');
  return t(`leadField.${known}` as StaticKey);
}
