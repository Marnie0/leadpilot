import { Link } from 'react-router-dom';
import type { LeadListItemDto } from '@leadpilot/shared';
import { Building2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { SOURCE_LABELS } from '@/lib/labels';
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
export function LeadCard({ lead }: { lead: LeadListItemDto }) {
  return (
    <Card className="gap-0 p-0 transition-colors hover:border-primary/40">
      <Link
        to={`/leads/${lead.id}`}
        className="flex flex-col gap-3 rounded-xl p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
              <p className="truncate text-xs text-muted-foreground">{SOURCE_LABELS[lead.source]}</p>
            )}
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        <p className="truncate text-sm text-muted-foreground">{lead.requestedService}</p>

        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={lead.stage} size="sm" />
          <PriorityBadge priority={lead.priority} />
          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(lead.estimatedValue, lead.currency)}
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
