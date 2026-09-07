import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applyFilterPatch, readList, readOne } from '@/lib/search-params';
import {
  FOLLOW_UP_FILTERS,
  LEAD_PRIORITIES,
  LEAD_SORT_FIELDS,
  LEAD_SOURCES,
  STAGE_KEYS,
  type FollowUpFilter,
  type LeadPriority,
  type LeadSortField,
  type LeadSource,
  type StageKey,
} from '@leadpilot/shared';

export interface LeadFilterState {
  q: string;
  stage: StageKey[];
  source: LeadSource[];
  priority: LeadPriority[];
  assignedToId: string[];
  followUp: FollowUpFilter;
  openOnly: boolean;
  archived: boolean;
  sortBy: LeadSortField;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const DEFAULTS: LeadFilterState = {
  q: '',
  stage: [],
  source: [],
  priority: [],
  assignedToId: [],
  followUp: 'any',
  openOnly: false,
  archived: false,
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

/**
 * Filter state lives in the URL rather than component state.
 *
 * That makes a filtered view shareable and bookmarkable, survives a refresh,
 * and makes the browser's back button behave the way users expect after
 * narrowing a list — none of which comes free with `useState`.
 */
export function useLeadFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<LeadFilterState>(() => {
    const page = Number(searchParams.get('page'));
    const pageSize = Number(searchParams.get('pageSize'));

    return {
      q: searchParams.get('q') ?? DEFAULTS.q,
      stage: readList(searchParams, 'stage', STAGE_KEYS),
      source: readList(searchParams, 'source', LEAD_SOURCES),
      priority: readList(searchParams, 'priority', LEAD_PRIORITIES),
      // Assignee ids are opaque, plus the literal `__unassigned__` sentinel.
      assignedToId: readList(searchParams, 'assignedToId'),
      followUp: readOne(searchParams, 'followUp', FOLLOW_UP_FILTERS, DEFAULTS.followUp),
      openOnly: searchParams.get('openOnly') === 'true',
      archived: searchParams.get('archived') === 'true',
      sortBy: readOne(searchParams, 'sortBy', LEAD_SORT_FIELDS, DEFAULTS.sortBy),
      sortDir: readOne(searchParams, 'sortDir', ['asc', 'desc'] as const, DEFAULTS.sortDir),
      page: Number.isFinite(page) && page > 0 ? page : DEFAULTS.page,
      pageSize:
        Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : DEFAULTS.pageSize,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<LeadFilterState>) => {
      setSearchParams(
        (current) => {
          const next = applyFilterPatch(current, patch, DEFAULTS);
          // Any change other than paging returns to page 1 — otherwise a
          // narrower filter can strand the user on a page that no longer exists.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  /** Count of active narrowing filters, for the "Filters (3)" button badge. */
  const activeFilterCount =
    filters.stage.length +
    filters.source.length +
    filters.priority.length +
    filters.assignedToId.length +
    (filters.followUp !== 'any' ? 1 : 0) +
    (filters.openOnly ? 1 : 0) +
    (filters.archived ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0 || filters.q.length > 0;

  return { filters, setFilters, resetFilters, activeFilterCount, hasActiveFilters };
}

export const LEAD_FILTER_DEFAULTS = DEFAULTS;
