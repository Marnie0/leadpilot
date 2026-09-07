import type { StageKey, StageType } from '@prisma/client';

/**
 * The six stages every new organisation starts with.
 *
 * Stages live in a table rather than a bare enum, so a tenant can rename or
 * recolour them later; this is only the seed. `nameAr` is populated up front so
 * the Phase 3 Arabic UI has real labels rather than fallbacks.
 */
export interface StagePreset {
  key: StageKey;
  name: string;
  nameAr: string;
  color: string;
  order: number;
  type: StageType;
}

export const DEFAULT_STAGE_PRESETS: readonly StagePreset[] = [
  { key: 'NEW', name: 'New', nameAr: 'جديد', color: '#64748b', order: 0, type: 'OPEN' },
  { key: 'CONTACTED', name: 'Contacted', nameAr: 'تم التواصل', color: '#0ea5e9', order: 1, type: 'OPEN' },
  { key: 'QUALIFIED', name: 'Qualified', nameAr: 'مؤهل', color: '#8b5cf6', order: 2, type: 'OPEN' },
  { key: 'PROPOSAL', name: 'Proposal', nameAr: 'عرض سعر', color: '#f59e0b', order: 3, type: 'OPEN' },
  { key: 'WON', name: 'Won', nameAr: 'تم الفوز', color: '#10b981', order: 4, type: 'WON' },
  { key: 'LOST', name: 'Lost', nameAr: 'خسارة', color: '#ef4444', order: 5, type: 'LOST' },
] as const;

/** Palette assigned round-robin to new users for their avatar fallback. */
export const AVATAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#059669',
  '#0891b2',
  '#c026d3',
  '#4f46e5',
] as const;

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}
