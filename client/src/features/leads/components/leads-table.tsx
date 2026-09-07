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
   * Makes the whole row clickable, which is what `cursor-pointer` was already
   * promising while only the name cell actually navigated.
   *
   * The real <Link> stays in the name cell so keyboard users can tab to it and
   * middle-click / ⌘-click still open a new tab; this handler only covers the
   * dead space around it, and bows out if the click landed on any other
   * interactive element.
   */
  const openLead = (event: React.MouseEvent<HTMLTableRowElement>, leadId: string) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if ((event.target as HTMLElement).closest('a, button, input, [role="button"]')) return;
    navigate(`/leads/${leadId}`);
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
              className="group cursor-pointer"
              onClick={(event) => openLead(event, lead.id)}
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
                    onCheckedChange={() => selection.toggle(lead.id)}
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
