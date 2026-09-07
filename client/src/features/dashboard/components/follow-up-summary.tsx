import { Link } from 'react-router-dom';
import type { DashboardFollowUpsDto } from '@leadpilot/shared';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { describeDueDate, formatNumber } from '@/lib/format';
import { CHANNEL_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

const BUCKETS = [
  { key: 'overdue', label: 'Overdue', href: '/leads?followUp=overdue', tone: 'text-destructive' },
  { key: 'today', label: 'Today', href: '/leads?followUp=today', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'thisWeek', label: 'This week', href: '/leads?followUp=week', tone: 'text-foreground' },
  { key: 'later', label: 'Later', href: '/leads', tone: 'text-muted-foreground' },
] as const;

const DUE_TONE: Record<string, string> = {
  overdue: 'text-destructive',
  today: 'text-amber-600 dark:text-amber-400',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground',
};

/**
 * Open follow-up workload, and the next few that are due.
 *
 * Always a snapshot of *now*, never filtered by the dashboard's reporting
 * range — "what do I owe someone a call about" is not a question about the last
 * ninety days. Each count links into the leads table with the matching filter
 * already applied, so the panel is a way in rather than a dead end.
 */
export function FollowUpSummary({ followUps }: { followUps: DashboardFollowUpsDto }) {
  const total =
    followUps.overdue + followUps.today + followUps.thisWeek + followUps.later;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {BUCKETS.map((bucket) => (
          <Link
            key={bucket.key}
            to={bucket.href}
            className="rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <p className={cn('text-lg font-semibold tabular-nums', bucket.tone)}>
              {formatNumber(followUps[bucket.key])}
            </p>
            <p className="text-xs text-muted-foreground">{bucket.label}</p>
          </Link>
        ))}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing scheduled"
          description="Follow-ups you book on a lead show up here."
          className="py-8"
        />
      ) : followUps.upcoming.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Next up
          </p>
          <ul className="divide-y">
            {followUps.upcoming.map((followUp) => {
              const due = describeDueDate(followUp.dueAt);
              return (
                <li key={followUp.id}>
                  <Link
                    to={`/leads/${followUp.leadId}`}
                    className="flex items-center gap-3 py-2 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{followUp.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {followUp.lead?.customerName ?? 'Lead'} ·{' '}
                        {CHANNEL_LABELS[followUp.channel]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-medium whitespace-nowrap',
                        DUE_TONE[due.tone],
                      )}
                    >
                      {due.label}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
