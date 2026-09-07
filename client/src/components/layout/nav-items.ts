import { BarChart3, CalendarClock, KanbanSquare, Users2, Contact } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
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
  { label: 'Leads', to: '/leads', icon: Contact },
  { label: 'Pipeline', to: '/pipeline', icon: KanbanSquare, comingSoon: true },
  { label: 'Dashboard', to: '/dashboard', icon: BarChart3, comingSoon: true },
  { label: 'Follow-ups', to: '/follow-ups', icon: CalendarClock, comingSoon: true },
  { label: 'Team', to: '/team', icon: Users2 },
];
