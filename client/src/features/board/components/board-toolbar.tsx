import { useEffect, useState } from 'react';
import {
  FOLLOW_UP_FILTERS,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  UNASSIGNED,
  type FollowUpFilter,
  type LeadPriority,
  type LeadSource,
} from '@leadpilot/shared';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectFilter, type FilterOption } from '@/components/common/multi-select-filter';
import { useT } from '@/lib/i18n';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { TeamMemberDetail } from '@/features/leads/api';
import type { BoardFilterState } from '../hooks/use-board-filters';

/**
 * Board filter bar.
 *
 * Same controls and same URL parameters as the leads table, minus stage, sort
 * and archived — see `useBoardFilters` for why each is absent. It reuses
 * `MultiSelectFilter`, so a filter behaves identically whichever screen the
 * user opens it on.
 */
export function BoardToolbar({
  filters,
  onChange,
  onReset,
  hasActiveFilters,
  members,
}: {
  filters: BoardFilterState;
  onChange: (patch: Partial<BoardFilterState>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  members: TeamMemberDetail[];
}) {
  const t = useT();

  // The input stays uncontrolled by the URL while the user types; the debounced
  // value is what drives the query and the address bar.
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchDraft, 350);

  useEffect(() => {
    if (debouncedSearch !== filters.q) onChange({ q: debouncedSearch });
    // `filters.q` is intentionally omitted: reacting to it here would fight the
    // user's typing whenever the URL updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchDraft((draft) => (draft === filters.q ? draft : filters.q));
  }, [filters.q]);

  const assigneeOptions: FilterOption[] = [
    { value: UNASSIGNED, label: t('common.unassigned') },
    ...members
      .filter((member) => member.isActive)
      .map((member) => ({
        value: member.id,
        label: member.name,
        adornment: (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: member.avatarColor }}
            aria-hidden
          />
        ),
      })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={t('filters.searchPipeline')}
          className="h-9 ps-9 pe-9"
          aria-label={t('filters.searchLeads')}
          type="search"
        />
        {searchDraft && (
          <button
            type="button"
            onClick={() => setSearchDraft('')}
            className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={t('common.clearSearch')}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <MultiSelectFilter
        label={t('filters.assignee')}
        options={assigneeOptions}
        selected={filters.assignedToId}
        onChange={(next) => onChange({ assignedToId: next })}
        searchable={assigneeOptions.length > 8}
      />
      <MultiSelectFilter
        label={t('filters.source')}
        options={LEAD_SOURCES.map((source) => ({
          value: source,
          label: t(`source.${source}`),
        }))}
        selected={filters.source}
        onChange={(next) => onChange({ source: next as LeadSource[] })}
      />
      <MultiSelectFilter
        label={t('filters.priority')}
        options={LEAD_PRIORITIES.map((priority) => ({
          value: priority,
          label: t(`priority.${priority}`),
        }))}
        selected={filters.priority}
        onChange={(next) => onChange({ priority: next as LeadPriority[] })}
      />

      <Select
        value={filters.followUp}
        onValueChange={(value) => onChange({ followUp: value as FollowUpFilter })}
      >
        <SelectTrigger size="sm" className="h-9 w-[152px]" aria-label={t('filters.followUp')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FOLLOW_UP_FILTERS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`followUpFilter.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={onReset}>
          <X className="size-3.5" /> {t('common.clearAll')}
        </Button>
      )}
    </div>
  );
}
