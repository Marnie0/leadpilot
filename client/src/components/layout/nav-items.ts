import { BarChart3, CalendarClock, KanbanSquare, Users2, Contact } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StaticKey } from '@/lib/i18n';

export interface NavItem {
  /** Resolved through `t` at render, so the sidebar follows the language. */
  labelKey: StaticKey;
  to: string;
  icon: LucideIcon;
  /** Rendered as a disabled row with a "Soon" badge until the phase ships. */
  comingSoon?: boolean;
}

/**
 * The full product navigation, including the destinations later phases will
 * fill in. Showing them disabled communicates the shape of the product without
 * pretending a half-built screen exists.
 */
export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.leads', to: '/leads', icon: Contact },
  { labelKey: 'nav.pipeline', to: '/pipeline', icon: KanbanSquare },
  { labelKey: 'nav.dashboard', to: '/dashboard', icon: BarChart3 },
  { labelKey: 'nav.followUps', to: '/follow-ups', icon: CalendarClock, comingSoon: true },
  { labelKey: 'nav.team', to: '/team', icon: Users2 },
];
