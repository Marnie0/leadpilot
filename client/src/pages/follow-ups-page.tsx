import { useEffect, useState } from 'react';
import { CalendarCheck, Search, X } from 'lucide-react';
import { FOLLOW_UP_BUCKETS, type FollowUpBucket } from '@leadpilot/shared';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PaginationBar } from '@/components/common/pagination-bar';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useFollowUpCounts, useFollowUps } from '@/features/follow-ups/api';
import { FollowUpRow } from '@/features/follow-ups/components/follow-up-row';
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
  const { filters, setFilters } = useFollowUpFilters();

  // The input is local so typing stays responsive, and the URL — which drives
  // the query — catches up once the user pauses.
  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilters({ q: debouncedSearch });
  }, [debouncedSearch, filters.q, setFilters]);

  // A back/forward navigation changes the URL without touching the input.
  useEffect(() => setSearch(filters.q), [filters.q]);

  const params = {
    bucket: filters.bucket,
    ...(filters.q && { q: filters.q }),
    ...(filters.mineOnly && { assignedToId: [user.id] }),
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const listQuery = useFollowUps(params);
  const countsQuery = useFollowUpCounts(params);
  const followUps = listQuery.data?.data ?? [];
  const counts = countsQuery.data;

  const empty = EMPTY_COPY[filters.bucket];
  const isFiltered = filters.q.length > 0 || filters.mineOnly;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={t('followUp.inboxTitle')}
        description={t('followUp.inboxDescription')}
        actions={
          <Button
            variant={filters.mineOnly ? 'default' : 'outline'}
            size="sm"
            aria-pressed={filters.mineOnly}
            onClick={() => setFilters({ mineOnly: !filters.mineOnly })}
          >
            {filters.mineOnly ? t('followUp.assigneeMine') : t('followUp.assigneeAll')}
          </Button>
        }
      />

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('followUp.searchPlaceholder')}
          aria-label={t('followUp.searchPlaceholder')}
          className="ps-9 pe-9"
        />
        {search.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
            aria-label={t('common.clearSearch')}
            onClick={() => setSearch('')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Horizontally scrollable rather than wrapping: five buckets in Arabic
          are wider than a phone, and a strip that reflows into two rows loses
          the "one line, in time order" reading that makes it useful. */}
      <div
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="tablist"
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
                role="tab"
                aria-selected={active}
                onClick={() => setFilters({ bucket })}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
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
            icon={CalendarCheck}
            title={isFiltered ? t('followUp.emptyFiltered') : t(empty.title)}
            description={isFiltered ? t('followUp.emptyFilteredBody') : t(empty.body)}
            {...(isFiltered && {
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ q: '', mineOnly: false })}
                >
                  {t('common.clearFilters')}
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
                itemLabel={t('followUp.inboxTitle').toLocaleLowerCase()}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
