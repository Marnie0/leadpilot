import { Link, useNavigate } from 'react-router-dom';
import type { LeadListItemDto, LeadSortField } from '@leadpilot/shared';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { LeadSelection } from '../hooks/use-lead-selection';
import { useFormat, useT, type StaticKey, type Translator } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { StageBadge } from './stage-badge';
import { PriorityBadge } from './priority-badge';
import { AssigneeAvatar } from './assignee-avatar';
import { FollowUpCell } from './follow-up-cell';

interface ColumnDefinition {
  id: string;
  labelKey: StaticKey;
  sortField?: LeadSortField;
  className?: string;
  /** Hides lower-priority columns until there is room for them. */
  hideBelow?: 'xl' | '2xl';
}

const COLUMNS: ColumnDefinition[] = [
  { id: 'customer', labelKey: 'leads.column.customer', sortField: 'customerName' },
  { id: 'service', labelKey: 'leads.column.service', sortField: 'company', hideBelow: 'xl' },
  { id: 'stage', labelKey: 'leads.column.stage', sortField: 'stage' },
  {
    id: 'value',
    labelKey: 'leads.column.value',
    sortField: 'estimatedValue',
    className: 'text-end',
  },
  { id: 'priority', labelKey: 'leads.column.priority', sortField: 'priority', hideBelow: '2xl' },
  { id: 'assignee', labelKey: 'leads.column.assignee' },
  { id: 'followUp', labelKey: 'leads.column.followUp', sortField: 'nextFollowUpAt' },
  { id: 'updated', labelKey: 'leads.column.updated', sortField: 'updatedAt', hideBelow: '2xl' },
];

const HIDE_CLASSES = {
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const;

function SortableHeader({
  column,
  sortBy,
  sortDir,
  onSort,
  t,
}: {
  column: ColumnDefinition;
  sortBy: LeadSortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: LeadSortField) => void;
  t: Translator;
}) {
  const label = t(column.labelKey);
  if (!column.sortField) return <>{label}</>;

  const isActive = sortBy === column.sortField;
  const Icon = !isActive ? ChevronsUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(column.sortField as LeadSortField)}
      className={cn(
        'group -mx-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 transition-colors',
        'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isActive && 'text-foreground',
      )}
      aria-label={t('leads.sortBy', { label })}
      // Announces the current sort to screen readers on the header cell.
      aria-pressed={isActive}
    >
      {label}
      {/* Vertical arrows: "ascending" is up in both directions, so no mirroring. */}
      <Icon
        className={cn(
          'size-3 transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
        )}
        aria-hidden
      />
    </button>
  );
}

/**
 * Desktop leads table.
 *
 * Rows are links rather than click handlers, so middle-click, ⌘-click and
 * "open in new tab" all behave the way a user expects from a list of records.
 */
export function LeadsTable({
  leads,
  isLoading,
  sortBy,
  sortDir,
  onSort,
  selection,
}: {
  leads: LeadListItemDto[];
  isLoading: boolean;
  sortBy: LeadSortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: LeadSortField) => void;
  selection: LeadSelection;
}) {
  const navigate = useNavigate();
  const t = useT();
  const format = useFormat();

  /**
   * What a click on a row means.
   *
   * Outside selection mode it opens the lead — which is what `cursor-pointer`
   * was already promising while only the name cell actually navigated.
   *
   * **Once anything is selected, a click selects instead.** Requiring people to
   * hit a 16px checkbox to add a second row, and punishing a near miss by
   * navigating away and discarding the whole selection, is the single most
   * annoying thing a table like this can do. Every app that has this — Gmail,
   * Finder, Linear — switches the row's meaning while a selection is live, and
   * Escape or Clear gets you back out.
   *
   * ⌘/Ctrl-click and middle-click still open a new tab in either mode, because
   * those are the browser's gestures rather than the table's.
   */
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, lead: LeadListItemDto) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
    // Real controls — the checkbox, the name link — handle their own clicks.
    if ((event.target as HTMLElement).closest('a, button, input, [role="button"]')) return;

    if (selection.isActive) {
      // A locked row cannot join the selection, and navigating away from it
      // would throw away everything picked so far. Doing nothing is the least
      // surprising answer; the checkbox tooltip says why.
      if (!lead.canEdit) return;
      selectRow(lead.id, event.shiftKey);
      return;
    }

    if (event.shiftKey) return;
    navigate(`/leads/${lead.id}`);
  };

  /** Shared by the row and the name link, so both behave identically. */
  const selectRow = (id: string, extend: boolean) => {
    selection.toggle(id, { extend });
    // Shift-clicking across rows otherwise leaves a ragged text selection
    // highlighted over half the table.
    if (extend) window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="scrollbar-slim w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={selection.allState}
                onCheckedChange={selection.toggleAll}
                disabled={!selection.hasSelectable}
                aria-label={t('bulk.selectAll')}
              />
            </TableHead>
            {COLUMNS.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  'whitespace-nowrap',
                  column.className,
                  column.hideBelow && HIDE_CLASSES[column.hideBelow],
                )}
                aria-sort={
                  column.sortField && sortBy === column.sortField
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <SortableHeader
                  column={column}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  t={t}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading &&
            leads.length === 0 &&
            Array.from({ length: 8 }, (_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell>
                  <Skeleton className="size-4 rounded-[4px]" />
                </TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(column.hideBelow && HIDE_CLASSES[column.hideBelow])}
                  >
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              className={cn(
                'group',
                // A locked row promises nothing while a selection is live,
                // because clicking it does nothing.
                selection.isActive && !lead.canEdit ? 'cursor-default' : 'cursor-pointer',
                // `bg-muted` is the table's own hover colour, so a selected row
                // was indistinguishable from the one under the pointer.
                'data-[state=selected]:bg-primary/8',
              )}
              onClick={(event) => handleRowClick(event, lead)}
              data-state={selection.isSelected(lead.id) ? 'selected' : undefined}
            >
              {/*
                A rep may read every lead but only edit their own, so a row they
                cannot act on is not selectable — with a reason attached, rather
                than a checkbox that is merely dead.
              */}
              <TableCell>
                {lead.canEdit ? (
                  <Checkbox
                    checked={selection.isSelected(lead.id)}
                    onClick={(event) => selectRow(lead.id, event.shiftKey)}
                    className="group-hover:border-muted-foreground/80"
                    aria-label={t('bulk.selectRow', { name: lead.customerName })}
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Checkbox disabled aria-label={t('bulk.locked')} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('bulk.locked')}</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>

              <TableCell className="max-w-[240px]">
                <Link
                  to={`/leads/${lead.id}`}
                  onClick={(event) => {
                    // In selection mode the name is part of the row, not a way
                    // out of it — except via the browser's own new-tab gesture.
                    if (!selection.isActive || event.metaKey || event.ctrlKey) return;
                    event.preventDefault();
                    if (lead.canEdit) selectRow(lead.id, event.shiftKey);
                  }}
                  className="block rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="block truncate font-medium text-foreground group-hover:text-primary">
                    {lead.customerName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lead.company ?? t(`source.${lead.source}`)}
                  </span>
                </Link>
              </TableCell>

              <TableCell className={cn('max-w-[220px]', HIDE_CLASSES.xl)}>
                <span className="block truncate text-sm text-foreground">
                  {lead.requestedService}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t(`source.${lead.source}`)}
                </span>
              </TableCell>

              <TableCell>
                <StageBadge stage={lead.stage} size="sm" />
              </TableCell>

              <TableCell className="text-end font-medium whitespace-nowrap tabular-nums">
                {format.currency(lead.estimatedValue, lead.currency)}
              </TableCell>

              <TableCell className={HIDE_CLASSES['2xl']}>
                <PriorityBadge priority={lead.priority} />
              </TableCell>

              <TableCell>
                <AssigneeAvatar member={lead.assignedTo} />
              </TableCell>

              <TableCell className="max-w-[180px]">
                <FollowUpCell dueAt={lead.nextFollowUpAt} />
              </TableCell>

              <TableCell
                className={cn(
                  'text-sm whitespace-nowrap text-muted-foreground',
                  HIDE_CLASSES['2xl'],
                )}
              >
                {format.relative(lead.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
