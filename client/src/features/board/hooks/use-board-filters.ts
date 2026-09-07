import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FOLLOW_UP_FILTERS,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  type FollowUpFilter,
  type LeadPriority,
  type LeadSource,
} from '@leadpilot/shared';
import { applyFilterPatch, readList, readOne } from '@/lib/search-params';

/**
 * Board filters are a deliberate subset of the table's.
 *
 * Stage is missing because the board *is* the stage breakdown — filtering by it
 * would empty columns rather than narrow cards. Sorting is missing because a
 * board is manually ordered. Archived is missing because archived leads have no
 * place on a working pipeline. Everything else uses the same parameter names as
 * `/leads`, so a filtered board and a filtered table read identically in the URL.
 */
export interface BoardFilterState {
  q: string;
  source: LeadSource[];
  priority: LeadPriority[];
  assignedToId: string[];
  followUp: FollowUpFilter;
}

const DEFAULTS: BoardFilterState = {
  q: '',
  source: [],
  priority: [],
  assignedToId: [],
  followUp: 'any',
};

export function useBoardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<BoardFilterState>(
    () => ({
      q: searchParams.get('q') ?? DEFAULTS.q,
      source: readList(searchParams, 'source', LEAD_SOURCES),
      priority: readList(searchParams, 'priority', LEAD_PRIORITIES),
      // Assignee ids are opaque, plus the literal `__unassigned__` sentinel.
      assignedToId: readList(searchParams, 'assignedToId'),
      followUp: readOne(searchParams, 'followUp', FOLLOW_UP_FILTERS, DEFAULTS.followUp),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<BoardFilterState>) => {
      setSearchParams((current) => applyFilterPatch(current, patch, DEFAULTS), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const activeFilterCount =
    filters.source.length +
    filters.priority.length +
    filters.assignedToId.length +
    (filters.followUp !== 'any' ? 1 : 0);

  return {
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0 || filters.q.length > 0,
  };
}

export const BOARD_FILTER_DEFAULTS = DEFAULTS;
