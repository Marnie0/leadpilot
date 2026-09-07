import { CalendarClock, CircleAlert } from 'lucide-react';
import { describeDueDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-amber-600 dark:text-amber-400',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground/70',
};

/** Renders a follow-up date as an urgency-coloured phrase rather than a raw date. */
export function FollowUpCell({
  dueAt,
  className,
}: {
  dueAt: string | null;
  className?: string;
}) {
  const { label, tone } = describeDueDate(dueAt);
  const Icon = tone === 'overdue' ? CircleAlert : CalendarClock;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', TONE_STYLES[tone], className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
