import { Link } from 'react-router-dom';
import type { DashboardFollowUpsDto } from '@leadpilot/shared';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useFormat, useT, type StaticKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const BUCKETS = [
  {
    key: 'overdue',
    labelKey: 'dashboard.followUpOverdue',
    href: '/leads?followUp=overdue',
    tone: 'text-destructive',
  },
  {
    key: 'today',
    labelKey: 'dashboard.followUpToday',
    href: '/leads?followUp=today',
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'thisWeek',
    labelKey: 'dashboard.followUpThisWeek',
    href: '/leads?followUp=week',
    tone: 'text-foreground',
  },
  // There is no "later" preset in the follow-up filter, so this one sorts the
  // whole list by next follow-up instead of pretending to filter. Linking it to
  // a bare /leads would claim a filter that was never applied.
  {
    key: 'later',
    labelKey: 'dashboard.followUpLater',
    href: '/leads?sortBy=nextFollowUpAt&sortDir=asc',
    tone: 'text-muted-foreground',
  },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<DashboardFollowUpsDto, 'upcoming'>;
  labelKey: StaticKey;
  href: string;
  tone: string;
}>;

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
  const t = useT();
  const format = useFormat();

  const total = followUps.overdue + followUps.today + followUps.thisWeek + followUps.later;

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
              {format.number(followUps[bucket.key])}
            </p>
            <p className="text-xs text-muted-foreground">{t(bucket.labelKey)}</p>
          </Link>
        ))}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t('dashboard.followUpsEmptyTitle')}
          description={t('dashboard.followUpsEmptyBody')}
          className="py-8"
        />
      ) : followUps.upcoming.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('dashboard.nextUp')}
          </p>
          <ul className="divide-y">
            {followUps.upcoming.map((followUp) => {
              const due = format.dueDate(followUp.dueAt);
              return (
                <li key={followUp.id}>
                  <Link
                    to={`/leads/${followUp.leadId}`}
                    className="flex items-center gap-3 py-2 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Direction from the text, so a Latin title truncates
                          from its own end rather than the interface's. */}
                      <p className="truncate text-sm text-foreground" dir="auto">
                        {followUp.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {followUp.lead?.customerName ?? t('dashboard.lead')} ·{' '}
                        {t(`channel.${followUp.channel}`)}
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
                      className="icon-directional size-4 shrink-0 text-muted-foreground"
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
