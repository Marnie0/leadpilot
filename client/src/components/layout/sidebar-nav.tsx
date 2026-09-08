import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useFollowUpCounts } from '@/features/follow-ups/api';
import { useFormat, useT } from '@/lib/i18n';
import { NAV_ITEMS } from './nav-items';

/**
 * Primary navigation.
 *
 * The overdue count rides on the Follow-ups row rather than living on the
 * follow-ups screen alone: the whole point of the feature is catching the thing
 * you have forgotten, and a number you only see once you go looking is a number
 * that has already failed. It is shown only when there is something to show.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const format = useFormat();
  const countsQuery = useFollowUpCounts({});
  const overdue = countsQuery.data?.overdue ?? 0;

  return (
    <nav className="flex flex-col gap-1" aria-label={t('nav.main')}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        const badge = item.to === '/follow-ups' && overdue > 0 ? overdue : null;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn('size-4 shrink-0', isActive && 'text-sidebar-primary')}
                  aria-hidden
                />
                <span className="flex-1">{label}</span>
                {badge !== null && (
                  <span
                    className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-destructive tabular-nums"
                    aria-label={t('bucket.overdue')}
                  >
                    {format.number(badge)}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
