import { Link } from 'react-router-dom';
import type { LeadListItemDto } from '@leadpilot/shared';
import { Building2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useFormat, useT } from '@/lib/i18n';
import { StageBadge } from './stage-badge';
import { PriorityBadge } from './priority-badge';
import { AssigneeAvatar } from './assignee-avatar';
import { FollowUpCell } from './follow-up-cell';

/**
 * Mobile and tablet presentation of a lead.
 *
 * A table with eight columns cannot survive a 375px viewport, so below `lg` the
 * same records render as cards — same data, laid out for a thumb.
 */
export function LeadCard({
  lead,
  selected,
  selectionActive = false,
  onToggleSelected,
}: {
  lead: LeadListItemDto;
  selected?: boolean;
  /** True once anything on the page is selected — a tap then picks, not opens. */
  selectionActive?: boolean;
  /** Omitted when the viewer cannot act on this lead, which hides the checkbox. */
  onToggleSelected?: () => void;
}) {
  const t = useT();
  const format = useFormat();

  return (
    <Card
      className={cn(
        'relative gap-0 p-0 transition-colors hover:border-primary/40',
        selected && 'border-primary/50 bg-accent/30',
      )}
    >
      {/*
        Outside the link rather than inside it: a checkbox nested in an anchor
        is a control the browser will happily navigate away from mid-tap.
      */}
      {onToggleSelected && (
        // A larger tap target than the 16px box itself: on touch, the corner of
        // a card is a hard thing to hit exactly.
        <span className="absolute end-0 top-0 z-10 flex size-12 items-center justify-center">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelected}
            aria-label={t('bulk.selectRow', { name: lead.customerName })}
          />
        </span>
      )}

      <Link
        to={`/leads/${lead.id}`}
        onClick={(event) => {
          /*
           * While a selection is live the whole card is a selection target.
           * On a phone the checkbox is a 16px corner of a 100px card, and
           * missing it used to navigate away and discard everything picked so
           * far — which is exactly the tap people were trying to make.
           */
          if (!selectionActive || event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          onToggleSelected?.();
        }}
        className={cn(
          'flex flex-col gap-3 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          onToggleSelected && 'pe-12',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-medium text-foreground">{lead.customerName}</p>
            {lead.company ? (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Building2 className="size-3 shrink-0" aria-hidden />
                {lead.company}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">{t(`source.${lead.source}`)}</p>
            )}
          </div>
          {/* Points into the record, so it follows the reading direction. It
              gives up its corner when a selection checkbox needs the space. */}
          {!onToggleSelected && (
            <ChevronRight
              className="icon-directional mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </div>

        <p className="truncate text-sm text-muted-foreground">{lead.requestedService}</p>

        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={lead.stage} size="sm" />
          <PriorityBadge priority={lead.priority} />
          <span className="ms-auto text-sm font-semibold text-foreground tabular-nums">
            {format.currency(lead.estimatedValue, lead.currency)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <AssigneeAvatar member={lead.assignedTo} showName />
          <FollowUpCell dueAt={lead.nextFollowUpAt} className="shrink-0 text-xs" />
        </div>
      </Link>
    </Card>
  );
}

export function LeadCardSkeleton() {
  return (
    <Card className="gap-3 p-4">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-3/5" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="h-8 w-full" />
    </Card>
  );
}
