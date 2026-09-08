import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FOLLOW_UP_BUCKETS,
  FOLLOW_UP_SORT_FIELDS,
  type FollowUpBucket,
  type FollowUpSortField,
} from '@leadpilot/shared';
import { applyFilterPatch, readList, readOne } from '@/lib/search-params';

export interface FollowUpFilterState {
  bucket: FollowUpBucket;
  q: string;
  /** User ids, plus the literal `__unassigned__`. Empty means everyone. */
  assignedToId: string[];
  sortBy: FollowUpSortField;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

/**
 * Overdue is the landing bucket on purpose.
 *
 * A follow-up inbox that opens on "everything" is a list you scroll; one that
 * opens on what you are already late for is a list you act on. The rest is one
 * click away.
 */
const DEFAULTS: FollowUpFilterState = {
  bucket: 'overdue',
  q: '',
  assignedToId: [],
  sortBy: 'dueAt',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
};

/** Inbox filters, kept in the URL for the same reasons the leads table does. */
export function useFollowUpFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FollowUpFilterState>(() => {
    const page = Number(searchParams.get('page'));
    const pageSize = Number(searchParams.get('pageSize'));
    return {
      bucket: readOne(searchParams, 'bucket', FOLLOW_UP_BUCKETS, DEFAULTS.bucket),
      q: searchParams.get('q') ?? DEFAULTS.q,
      // Opaque ids plus the shared `__unassigned__` sentinel, exactly as the
      // leads table reads its own assignee filter.
      assignedToId: readList(searchParams, 'assignedToId'),
      sortBy: readOne(searchParams, 'sortBy', FOLLOW_UP_SORT_FIELDS, DEFAULTS.sortBy),
      sortDir: readOne(searchParams, 'sortDir', ['asc', 'desc'] as const, DEFAULTS.sortDir),
      page: Number.isFinite(page) && page > 0 ? page : DEFAULTS.page,
      pageSize:
        Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : DEFAULTS.pageSize,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<FollowUpFilterState>) => {
      setSearchParams(
        (current) => {
          const next = applyFilterPatch(current, patch, DEFAULTS);
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /**
   * Clears what is narrowing the list, and leaves you where you are.
   *
   * Wiping the whole query string also reset the bucket, so clearing a search
   * while looking at the trash threw you back to Overdue — which is not what
   * "clear filters" offers to do.
   */
  const resetFilters = useCallback(
    () => setFilters({ q: '', assignedToId: [], page: 1 }),
    [setFilters],
  );

  /** Anything narrowing the current bucket, for the "clear" affordance. */
  const hasActiveFilters = filters.q.length > 0 || filters.assignedToId.length > 0;

  return { filters, setFilters, resetFilters, hasActiveFilters };
}

export const FOLLOW_UP_FILTER_DEFAULTS = DEFAULTS;
