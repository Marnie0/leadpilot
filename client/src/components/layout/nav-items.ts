import { BarChart3, CalendarClock, KanbanSquare, Settings, Users2, Contact } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StaticKey } from '@/lib/i18n';

export interface NavItem {
  /** Resolved through `t` at render, so the sidebar follows the language. */
  labelKey: StaticKey;
  to: string;
  icon: LucideIcon;
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
  { labelKey: 'nav.settings', to: '/settings', icon: Settings },
];
