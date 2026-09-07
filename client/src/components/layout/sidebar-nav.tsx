import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { NAV_ITEMS } from './nav-items';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();

  return (
    <nav className="flex flex-col gap-1" aria-label={t('nav.main')}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);

        if (item.comingSoon) {
          return (
            <span
              key={item.to}
              aria-disabled
              title={t('common.comingLater')}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              <Badge variant="secondary" className="text-[10px] font-medium">
                {t('common.soon')}
              </Badge>
            </span>
          );
        }

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
                {label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
