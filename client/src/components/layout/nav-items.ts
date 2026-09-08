import {
  BarChart3,
  CalendarClock,
  Contact,
  KanbanSquare,
  Settings,
  Trash2,
  Users2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StaticKey } from '@/lib/i18n';

export interface NavItem {
  /** Resolved through `t` at render, so the sidebar follows the language. */
  labelKey: StaticKey;
  to: string;
  icon: LucideIcon;
  /**
   * Query parameters that are part of this destination's identity.
   *
   * Trash is the leads list in a particular view rather than a route of its
   * own, and a `NavLink` decides "am I active" from the path alone — so without
   * this, opening the trash would light up Leads and Trash at once, and every
   * other visit to Leads would light up Trash. `isNavItemActive` compares these
   * against the live query string so exactly one row is ever current.
   */
  params?: Record<string, string>;
}

/**
 * Whether `item` is the destination currently on screen.
 *
 * Two rows can share a path, so the one whose parameters match wins and the
 * plainer one steps aside: `/leads` is only "Leads" when it is *not* showing
 * the trash.
 */
export function isNavItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [path] = item.to.split('?');
  if (pathname !== path) return false;

  const current = new URLSearchParams(search);
  const siblings = NAV_ITEMS.filter((other) => other !== item && other.to.startsWith(`${path}?`));

  if (item.params) {
    return Object.entries(item.params).every(([key, value]) => current.get(key) === value);
  }
  // The bare row is active only while no sibling's parameters match.
  return !siblings.some((sibling) =>
    Object.entries(sibling.params ?? {}).every(([key, value]) => current.get(key) === value),
  );
}

/**
 * The full product navigation.
 *
 * Ordered by how often a rep opens them, not by how the product was built:
 * leads first, then the two ways of looking at them, then the work they
 * generate, then the things you set once.
 */
export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.leads', to: '/leads', icon: Contact },
  { labelKey: 'nav.pipeline', to: '/pipeline', icon: KanbanSquare },
  { labelKey: 'nav.dashboard', to: '/dashboard', icon: BarChart3 },
  { labelKey: 'nav.followUps', to: '/follow-ups', icon: CalendarClock },
  { labelKey: 'nav.team', to: '/team', icon: Users2 },
  /*
   * Trash sits below the working screens and above settings: it is somewhere
   * you go on purpose, rarely, and it is the answer to "where did that go" —
   * which is a question nobody can answer from a dropdown they never opened.
   */
  { labelKey: 'nav.trash', to: '/leads?view=trash', icon: Trash2, params: { view: 'trash' } },
  { labelKey: 'nav.settings', to: '/settings', icon: Settings },
];
