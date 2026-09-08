import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Trash2 } from 'lucide-react';
import { FOLLOW_UP_BUCKETS, TRASH_RETENTION_DAYS, type FollowUpBucket } from '@leadpilot/shared';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PaginationBar } from '@/components/common/pagination-bar';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTeamMembers } from '@/features/leads/api';
import { useFollowUpCounts, useFollowUps } from '@/features/follow-ups/api';
import { FollowUpRow } from '@/features/follow-ups/components/follow-up-row';
import { FollowUpToolbar } from '@/features/follow-ups/components/follow-up-toolbar';
import { useFollowUpFilters } from '@/features/follow-ups/hooks/use-follow-up-filters';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFormat, useT } from '@/lib/i18n';
import type { StaticKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Each bucket's own empty state — "nothing overdue" is good news, "nothing
 *  later" is a prompt, and one generic line cannot be both. */
const EMPTY_COPY: Record<FollowUpBucket, { title: StaticKey; body: StaticKey }> = {
  overdue: { title: 'followUp.emptyOverdue', body: 'followUp.emptyOverdueBody' },
  today: { title: 'followUp.emptyToday', body: 'followUp.emptyTodayBody' },
  week: { title: 'followUp.emptyWeek', body: 'followUp.emptyWeekBody' },
  later: { title: 'followUp.emptyLater', body: 'followUp.emptyLaterBody' },
  done: { title: 'followUp.emptyDone', body: 'followUp.emptyDoneBody' },
  cancelled: { title: 'followUp.emptyCancelled', body: 'followUp.emptyCancelledBody' },
  trash: { title: 'followUp.emptyTrash', body: 'followUp.emptyTrashBody' },
};

/**
 * The follow-up inbox.
 *
 * Organised by *when*, not by lead: the question this screen answers is "what
 * do I owe someone today", and that cuts across the pipeline. Grouping by lead
 * would rebuild the leads table with worse sorting.
 */
export function FollowUpsPage() {
  const t = useT();
  const format = useFormat();
  const user = useCurrentUser();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useFollowUpFilters();
  const teamQuery = useTeamMembers();

  // The input is local so typing stays responsive, and the URL — which drives
  // the query — catches up once the user pauses.
  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch });
    // `filters.q` is intentionally omitted, matching the leads filter bar.
    // Reacting to it here makes the two effects fight: clearing the box wrote
    // the URL, the URL wrote the box back from a debounce that had not caught
    // up, and "Clear filters" landed exactly where it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the box in step when the URL changes from outside (reset, back button).
  useEffect(() => {
    setSearch((draft) => (draft === filters.q ? draft : filters.q));
  }, [filters.q]);

  const params = {
    bucket: filters.bucket,
    ...(filters.q && { q: filters.q }),
    ...(filters.assignedToId.length > 0 && { assignedToId: filters.assignedToId }),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const listQuery = useFollowUps(params);
  const countsQuery = useFollowUpCounts(params);
  const followUps = listQuery.data?.data ?? [];
  const counts = countsQuery.data;

  const empty = EMPTY_COPY[filters.bucket];
  // A workspace that has never booked one is a different situation from a
  // bucket that happens to be clear. "Nothing overdue — every promise you have
  // made is still in the future" is true of somebody who has made none, and
  // reads as smug rather than helpful.
  const isFirstRun =
    !hasActiveFilters && counts !== undefined && Object.values(counts).every((n) => n === 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title={t('followUp.inboxTitle')} description={t('followUp.inboxDescription')} />

      <FollowUpToolbar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        members={teamQuery.data ?? []}
        currentUserId={user.id}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Horizontally scrollable rather than wrapping: seven buckets in Arabic
          are wider than a phone, and a strip that reflows into two rows loses
          the "one line, in time order" reading that makes it useful. */}
      <div
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="group"
        aria-label={t('followUp.inboxTitle')}
      >
        <div className="inline-flex min-w-full gap-1 rounded-lg bg-muted p-1">
          {FOLLOW_UP_BUCKETS.map((bucket) => {
            const active = filters.bucket === bucket;
            const count = counts?.[bucket];
            return (
              <button
                key={bucket}
                type="button"
                /*
                 * `aria-pressed`, not `role="tab"`. These look like a segmented
                 * control but behave like filter chips: they narrow a paginated
                 * list and write to the URL. Claiming the tab role would promise
                 * a `tabpanel` and arrow-key roving focus that are not there,
                 * and half-implemented ARIA reads worse to a screen reader than
                 * plain buttons that say whether they are on.
                 */
                aria-pressed={active}
                onClick={() => setFilters({ bucket })}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {bucket === 'trash' && <Trash2 className="size-3.5" aria-hidden />}
                {t(`bucket.${bucket}`)}
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums',
                      bucket === 'overdue' && !active
                        ? 'bg-destructive/15 text-destructive'
                        : active
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-background/70 text-muted-foreground',
                    )}
                  >
                    {format.number(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* The retention is stated where the trash is, not buried in a help page:
          "it disappears eventually" is only reassuring if you know when. */}
      {filters.bucket === 'trash' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trash2 className="size-3.5 shrink-0" aria-hidden />
          {t('followUp.trashNotice', { count: TRASH_RETENTION_DAYS })}
        </p>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        {listQuery.isError ? (
          <ErrorState
            error={listQuery.error}
            onRetry={() => void listQuery.refetch()}
            title={t('followUp.couldNotLoad')}
          />
        ) : listQuery.isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-start gap-4 px-4 py-4 sm:px-6">
                <Skeleton className="hidden size-9 shrink-0 rounded-full sm:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={filters.bucket === 'trash' ? Trash2 : CalendarCheck}
            title={
              hasActiveFilters
                ? t('followUp.emptyFiltered')
                : isFirstRun
                  ? t('followUp.emptyWorkspace')
                  : t(empty.title)
            }
            description={
              hasActiveFilters
                ? t('followUp.emptyFilteredBody')
                : isFirstRun
                  ? t('followUp.emptyWorkspaceBody')
                  : t(empty.body)
            }
            {...(hasActiveFilters
              ? {
                  action: (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      {t('common.clearFilters')}
                    </Button>
                  ),
                }
              : isFirstRun && {
                  action: (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/leads">{t('followUp.goToLeads')}</Link>
                    </Button>
                  ),
                })}
          />
        ) : (
          <>
            <ul
              className={cn(
                'divide-y',
                // A refetch behind `placeholderData` keeps the old rows on
                // screen; dimming them says so without moving anything.
                listQuery.isPlaceholderData && 'opacity-60 transition-opacity',
              )}
            >
              {followUps.map((followUp) => (
                <FollowUpRow key={followUp.id} followUp={followUp} />
              ))}
            </ul>
            {listQuery.data && (
              <PaginationBar
                meta={listQuery.data.meta}
                onPageChange={(page) => setFilters({ page })}
                onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
                itemLabel={t('followUp.itemLabel')}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
