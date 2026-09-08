import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from 'lucide-react';
import { FOLLOW_UP_SORT_FIELDS, UNASSIGNED, type FollowUpSortField } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelectFilter } from '@/components/common/multi-select-filter';
import type { TeamMemberDetail } from '@/features/leads/api';
import { initials } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { FollowUpFilterState } from '../hooks/use-follow-up-filters';

/**
 * Search, assignee and sort — the same three controls the leads table offers,
 * in the same components, so a filter learned on one screen works on the other.
 *
 * The assignee control replaces a two-state "Everyone / Assigned to me" toggle.
 * That answered the only question its author had; a manager wanting to see what
 * one rep is sitting on could not ask it.
 */
export function FollowUpToolbar({
  filters,
  onChange,
  onReset,
  hasActiveFilters,
  members,
  currentUserId,
  search,
  onSearchChange,
}: {
  filters: FollowUpFilterState;
  onChange: (patch: Partial<FollowUpFilterState>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  members: TeamMemberDetail[];
  currentUserId: string;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const t = useT();

  const assigneeOptions = [
    // Yourself first: it is the filter this screen is opened to apply.
    ...members
      .filter((member) => member.id === currentUserId)
      .map((member) => ({
        value: member.id,
        label: `${member.name} ${t('common.you')}`,
        adornment: <Swatch color={member.avatarColor} name={member.name} />,
      })),
    ...members
      .filter((member) => member.id !== currentUserId)
      .map((member) => ({
        value: member.id,
        label: member.isActive ? member.name : `${member.name}${t('common.deactivatedSuffix')}`,
        adornment: <Swatch color={member.avatarColor} name={member.name} />,
      })),
    { value: UNASSIGNED, label: t('common.unassigned') },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
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
            onClick={() => onSearchChange('')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label={t('filters.assignee')}
          options={assigneeOptions}
          selected={filters.assignedToId}
          onChange={(assignedToId) => onChange({ assignedToId })}
          searchable
        />

        <Select
          value={filters.sortBy}
          onValueChange={(value) => onChange({ sortBy: value as FollowUpSortField })}
        >
          <SelectTrigger size="sm" className="w-[168px]" aria-label={t('filters.sort')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLLOW_UP_SORT_FIELDS.map((field) => (
              <SelectItem key={field} value={field}>
                {t(`followUpSort.${field}`)}
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

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            {t('common.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  );
}

function Swatch({ color, name }: { color: string; name: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
