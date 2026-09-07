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
import { formatCurrency, formatRelative } from '@/lib/format';
import { SOURCE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { StageBadge } from './stage-badge';
import { PriorityBadge } from './priority-badge';
import { AssigneeAvatar } from './assignee-avatar';
import { FollowUpCell } from './follow-up-cell';

interface ColumnDefinition {
  id: string;
  label: string;
  sortField?: LeadSortField;
  className?: string;
  /** Hides lower-priority columns until there is room for them. */
  hideBelow?: 'xl' | '2xl';
}

const COLUMNS: ColumnDefinition[] = [
  { id: 'customer', label: 'Customer', sortField: 'customerName' },
  { id: 'service', label: 'Service', sortField: 'company', hideBelow: 'xl' },
  { id: 'stage', label: 'Stage', sortField: 'stage' },
  { id: 'value', label: 'Value', sortField: 'estimatedValue', className: 'text-right' },
  { id: 'priority', label: 'Priority', sortField: 'priority', hideBelow: '2xl' },
  { id: 'assignee', label: 'Rep' },
  { id: 'followUp', label: 'Next follow-up', sortField: 'nextFollowUpAt' },
  { id: 'updated', label: 'Updated', sortField: 'updatedAt', hideBelow: '2xl' },
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
}: {
  column: ColumnDefinition;
  sortBy: LeadSortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: LeadSortField) => void;
}) {
  if (!column.sortField) return <>{column.label}</>;

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
      aria-label={`Sort by ${column.label}`}
      // Announces the current sort to screen readers on the header cell.
      aria-pressed={isActive}
    >
      {column.label}
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
}: {
  leads: LeadListItemDto[];
  isLoading: boolean;
  sortBy: LeadSortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: LeadSortField) => void;
}) {
  const navigate = useNavigate();

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
    <div className="w-full overflow-x-auto scrollbar-slim">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
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
                <SortableHeader column={column} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading &&
            leads.length === 0 &&
            Array.from({ length: 8 }, (_, index) => (
              <TableRow key={`skeleton-${index}`}>
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
            >
              <TableCell className="max-w-[240px]">
                <Link
                  to={`/leads/${lead.id}`}
                  className="block rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="block truncate font-medium text-foreground group-hover:text-primary">
                    {lead.customerName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lead.company ?? SOURCE_LABELS[lead.source]}
                  </span>
                </Link>
              </TableCell>

              <TableCell className={cn('max-w-[220px]', HIDE_CLASSES.xl)}>
                <span className="block truncate text-sm text-foreground">
                  {lead.requestedService}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {SOURCE_LABELS[lead.source]}
                </span>
              </TableCell>

              <TableCell>
                <StageBadge stage={lead.stage} size="sm" />
              </TableCell>

              <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                {formatCurrency(lead.estimatedValue, lead.currency)}
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
                {formatRelative(lead.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
