import { useEffect, useState } from 'react';
import {
  FOLLOW_UP_FILTERS,
  LEAD_PRIORITIES,
  LEAD_SORT_FIELDS,
  LEAD_SOURCES,
  STAGE_KEYS,
  UNASSIGNED,
  type FollowUpFilter,
  type LeadPriority,
  type LeadSortField,
  type LeadSource,
  type PipelineStageDto,
  type StageKey,
} from '@leadpilot/shared';
import { Archive, ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from 'lucide-react';
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
import { stageName } from '@/lib/labels';
import { useI18n } from '@/lib/i18n';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { LeadFilterState } from '../hooks/use-lead-filters';
import type { TeamMemberDetail } from '../api';

export function LeadFilterBar({
  filters,
  onChange,
  onReset,
  hasActiveFilters,
  stages,
  members,
}: {
  filters: LeadFilterState;
  onChange: (patch: Partial<LeadFilterState>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  stages: PipelineStageDto[];
  members: TeamMemberDetail[];
}) {
  const { t, locale } = useI18n();

  // The input is uncontrolled by the URL while the user types; the debounced
  // value is what actually drives the query and the address bar.
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchDraft, 350);

  useEffect(() => {
    if (debouncedSearch !== filters.q) onChange({ q: debouncedSearch });
    // `filters.q` is intentionally omitted: reacting to it here would fight the
    // user's typing whenever the URL updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the box in step when the URL changes from outside (reset, back button).
  useEffect(() => {
    setSearchDraft((draft) => (draft === filters.q ? draft : filters.q));
  }, [filters.q]);

  // Before the stages have loaded, fall back to the default six by key. Their
  // names come from the dictionary rather than the row, because there is no row.
  const stageOptions: FilterOption[] = (
    stages.length > 0
      ? stages.map((stage) => ({
          key: stage.key,
          name: stageName(stage, locale),
          color: stage.color,
        }))
      : STAGE_KEYS.map((key) => ({ key, name: t(`stage.${key}`), color: '#94a3b8' }))
  ).map((stage) => ({
    value: stage.key,
    label: stage.name,
    adornment: (
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
    ),
  }));

  const sourceOptions: FilterOption[] = LEAD_SOURCES.map((source) => ({
    value: source,
    label: t(`source.${source}`),
  }));

  const priorityOptions: FilterOption[] = LEAD_PRIORITIES.map((priority) => ({
    value: priority,
    label: t(`priority.${priority}`),
  }));

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
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t('filters.searchPlaceholder')}
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

        <div className="flex items-center gap-2 sm:ms-auto">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => onChange({ sortBy: value as LeadSortField })}
          >
            <SelectTrigger size="sm" className="w-[168px]" aria-label={t('filters.sort')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {LEAD_SORT_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {t(`sort.${field}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => onChange({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
            aria-label={
              filters.sortDir === 'asc' ? t('filters.sortAscending') : t('filters.sortDescending')
            }
            title={filters.sortDir === 'asc' ? t('filters.ascending') : t('filters.descending')}
          >
            {filters.sortDir === 'asc' ? (
              <ArrowUpNarrowWide className="size-4" />
            ) : (
              <ArrowDownWideNarrow className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label={t('filters.stage')}
          options={stageOptions}
          selected={filters.stage}
          onChange={(next) => onChange({ stage: next as StageKey[] })}
        />
        <MultiSelectFilter
          label={t('filters.assignee')}
          options={assigneeOptions}
          selected={filters.assignedToId}
          onChange={(next) => onChange({ assignedToId: next })}
          searchable={assigneeOptions.length > 8}
        />
        <MultiSelectFilter
          label={t('filters.source')}
          options={sourceOptions}
          selected={filters.source}
          onChange={(next) => onChange({ source: next as LeadSource[] })}
        />
        <MultiSelectFilter
          label={t('filters.priority')}
          options={priorityOptions}
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

        <Button
          variant={filters.openOnly ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 border-dashed data-[active=true]:border-solid"
          data-active={filters.openOnly}
          onClick={() => onChange({ openOnly: !filters.openOnly })}
          aria-pressed={filters.openOnly}
        >
          {t('filters.openOnly')}
        </Button>

        <Button
          variant={filters.archived ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 border-dashed data-[active=true]:border-solid"
          data-active={filters.archived}
          onClick={() => onChange({ archived: !filters.archived, openOnly: false })}
          aria-pressed={filters.archived}
          title={t('filters.archivedTitle')}
        >
          <Archive className="size-3.5" /> {t('filters.archived')}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={onReset}>
            <X className="size-3.5" /> {t('common.clearAll')}
          </Button>
        )}
      </div>
    </div>
  );
}
