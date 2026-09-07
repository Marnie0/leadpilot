import type { LeadPriority } from '@leadpilot/shared';
import { cn } from '@/lib/utils';
import { PRIORITY_STYLES } from '@/lib/labels';
import { useT } from '@/lib/i18n';

export function PriorityBadge({
  priority,
  className,
}: {
  priority: LeadPriority;
  className?: string;
}) {
  const t = useT();

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {t(`priority.${priority}`)}
    </span>
  );
}
