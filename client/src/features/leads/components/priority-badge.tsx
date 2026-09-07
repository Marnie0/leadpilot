import type { LeadPriority } from '@leadpilot/shared';
import { cn } from '@/lib/utils';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/labels';

export function PriorityBadge({
  priority,
  className,
}: {
  priority: LeadPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
