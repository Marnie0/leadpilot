import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LeadListItemDto, PipelineStageDto, StageKey } from '@leadpilot/shared';
import { Building2, GripVertical, Lock, MoveRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AssigneeAvatar } from '@/features/leads/components/assignee-avatar';
import { FollowUpCell } from '@/features/leads/components/follow-up-cell';
import { PriorityBadge } from '@/features/leads/components/priority-badge';

/**
 * The card's visual, with no drag wiring.
 *
 * Split out because the drag overlay renders the same thing outside the
 * sortable tree — sharing it keeps the card under the cursor pixel-identical to
 * the placeholder it left behind.
 */
function BoardCardBody({ lead, currency }: { lead: LeadListItemDto; currency: string }) {
  return (
    <>
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{lead.customerName}</p>
        {lead.company && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{lead.company}</span>
          </p>
        )}
      </div>

      <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
        {lead.requestedService}
      </p>

      <div className="flex items-center gap-2">
        <PriorityBadge priority={lead.priority} />
        <span className="ml-auto text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(lead.estimatedValue, currency)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <AssigneeAvatar member={lead.assignedTo} />
        <FollowUpCell dueAt={lead.nextFollowUpAt} className="min-w-0 text-xs" />
      </div>
    </>
  );
}

/** The card as it appears under the cursor mid-drag. */
export function BoardCardOverlay({ lead, currency }: { lead: LeadListItemDto; currency: string }) {
  return (
    <Card className="w-[272px] cursor-grabbing gap-2.5 border-primary/50 p-3 shadow-xl ring-2 ring-primary/20">
      <BoardCardBody lead={lead} currency={currency} />
    </Card>
  );
}

export function BoardCard({
  lead,
  currency,
  stages,
  onMoveToStage,
}: {
  lead: LeadListItemDto;
  currency: string;
  stages: PipelineStageDto[];
  onMoveToStage: (stageKey: StageKey) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    // A rep cannot move a colleague's lead, so the card does not pretend to be
    // draggable. The server rejects it either way; a lock icon is a kinder way
    // to learn that than a card snapping back after a 403.
    disabled: !lead.canEdit,
  });

  /*
   * A pointer drag ends with a `click` on whatever sat under the cursor, which
   * on this card is the link to the lead. Without this the user drops a card
   * and finds themselves on the detail page. The flag is set while dragging and
   * consumed by the first click that follows.
   */
  const wasDragged = useRef(false);
  useEffect(() => {
    if (isDragging) wasDragged.current = true;
  }, [isDragging]);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Pointer listeners cover the whole card so it can be grabbed anywhere.
      // `attributes` are deliberately not spread here — they carry a tabIndex,
      // and a second tab stop wrapping the link would be noise for keyboard
      // users. The grip button below is their handle.
      {...(lead.canEdit ? listeners : {})}
      className={cn(
        'group relative gap-0 p-0 transition-shadow select-none',
        lead.canEdit ? 'cursor-grab hover:border-primary/40 active:cursor-grabbing' : 'opacity-90',
        isDragging && 'opacity-40',
      )}
    >
      <Link
        to={`/leads/${lead.id}`}
        /*
         * Chrome starts its own native drag on an anchor as soon as the pointer
         * moves, which cancels the pointer event stream dnd-kit is listening
         * to — the card would ghost under the cursor and never actually move.
         * Since the whole card is the drag surface and the link fills it, the
         * browser's drag behaviour has to be switched off explicitly.
         */
        draggable={false}
        onClick={(event) => {
          if (wasDragged.current) {
            event.preventDefault();
            wasDragged.current = false;
          }
        }}
        className="flex flex-col gap-2.5 rounded-xl p-3 pr-14 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <BoardCardBody lead={lead} currency={currency} />
      </Link>

      {/*
        Controls live in the card's right gutter, outside the link's hit area.
        On a mouse they fade in on hover — six columns of cards each showing two
        permanent icons is a lot of furniture. On touch there is no hover to
        reveal them with, so `pointer-coarse` pins them visible.
      */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
        {lead.canEdit ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Move ${lead.customerName} to another stage`}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                >
                  <MoveRight className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              {/*
                Dragging is not the only way to move a card. This is the path for
                touch, and for moving a lead into a column scrolled off screen —
                both of which a drag handles badly.
              */}
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {stages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    disabled={stage.key === lead.stage.key}
                    onSelect={() => onMoveToStage(stage.key)}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden
                    />
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* The keyboard drag control: space to lift, arrows to move, space to drop. */}
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${lead.customerName}`}
              className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing pointer-coarse:opacity-100"
            >
              <GripVertical className="size-3.5" />
            </button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex size-6 items-center justify-center text-muted-foreground/60">
                <Lock className="size-3.5" aria-hidden />
                <span className="sr-only">You cannot move this lead</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Assigned to someone else — only an owner or admin can move it
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}

export function BoardCardSkeleton() {
  return (
    <Card className="gap-2 p-3">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  );
}
