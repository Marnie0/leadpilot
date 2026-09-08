import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FOLLOW_UP_BUCKETS, type FollowUpBucket } from '@leadpilot/shared';
import { applyFilterPatch, readOne } from '@/lib/search-params';

export interface FollowUpFilterState {
  bucket: FollowUpBucket;
  q: string;
  /** `true` narrows to the signed-in user; the id itself is resolved at query time. */
  mineOnly: boolean;
  page: number;
  pageSize: number;
}

/**
 * Overdue is the landing bucket on purpose.
 *
 * A follow-up inbox that opens on "everything" is a list you scroll; one that
 * opens on what you are already late for is a list you act on. The tab strip
 * makes the rest one click away.
 */
const DEFAULTS: FollowUpFilterState = {
  bucket: 'overdue',
  q: '',
  mineOnly: false,
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
      mineOnly: searchParams.get('mineOnly') === 'true',
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

  return { filters, setFilters };
}
