import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BoardDto, StageKey } from '@leadpilot/shared';
import { Plus, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ApiError } from '@/lib/api-client';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTeamMembers } from '@/features/leads/api';
import { LeadFormDialog } from '@/features/leads/components/lead-form-dialog';
import {
  applyBoardMove,
  useBoard,
  useLoadMoreColumn,
  useMoveLeadOnBoard,
  type BoardMove,
} from '@/features/board/api';
import { useBoardFilters } from '@/features/board/hooks/use-board-filters';
import { isSamePosition, positionOf, resolveDrop } from '@/features/board/lib/resolve-drop';
import { BoardColumn } from '@/features/board/components/board-column';
import { BoardToolbar } from '@/features/board/components/board-toolbar';
import { BoardCardOverlay } from '@/features/board/components/board-card';
import { LostReasonDialog } from '@/features/board/components/lost-reason-dialog';

/**
 * The pipeline board.
 *
 * ## How a drag stays in sync with the server
 *
 * Three things describe the board at any moment, and they are layered:
 *
 *  1. `boardQuery.data` — what the server last said.
 *  2. The optimistic write the move mutation makes into that same cache, so a
 *     dropped card stays put instead of snapping back for the length of a
 *     round trip.
 *  3. `preview` — a local copy used *only* while a drag is in progress, so
 *     cards shuffle under the cursor before anything has been committed.
 *
 * The preview is discarded the moment the cached board changes, which is
 * exactly when the optimistic write lands. The two are computed by the same
 * `applyBoardMove`, so they agree and the handover is invisible. If the request
 * fails the cache rolls back, that counts as a change, and the card returns to
 * where it started.
 */
export function PipelinePage() {
  const user = useCurrentUser();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useBoardFilters();

  const boardQuery = useBoard(filters);
  const teamQuery = useTeamMembers();
  const moveLead = useMoveLeadOnBoard(filters);
  const loadMore = useLoadMoreColumn(filters);

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<BoardDto | null>(null);
  /** A move into a Lost stage, held until the reason prompt is answered. */
  const [pendingLoss, setPendingLoss] = useState<BoardMove | null>(null);

  // Whenever the cached board changes — a refetch, or the optimistic write a
  // drop makes — the local preview has served its purpose.
  useEffect(() => {
    setPreview(null);
  }, [boardQuery.data]);

  const board = preview ?? boardQuery.data;

  /*
   * Mouse and touch are deliberately separate sensors rather than one
   * PointerSensor.
   *
   * A pointer sensor has to pick a single activation rule for both, and the two
   * need opposite ones. With a mouse, a few pixels of travel is the right
   * threshold — anything longer makes dragging feel sticky. With a finger, that
   * same rule steals every attempt to *scroll* the column, because a scroll
   * starts as a touch on a card that then moves. A short press-and-hold is the
   * standard way out: a swipe scrolls, a hold picks the card up.
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stages = useMemo(() => board?.columns.map((column) => column.stage) ?? [], [board]);
  const activeLead = useMemo(
    () =>
      activeId
        ? board?.columns.flatMap((column) => column.leads).find((lead) => lead.id === activeId)
        : undefined,
    [activeId, board],
  );

  const totals = useMemo(() => {
    if (!board) return null;
    const open = board.columns.filter((column) => column.stage.type === 'OPEN');
    return {
      leads: board.columns.reduce((sum, column) => sum + column.total, 0),
      openValue: open.reduce((sum, column) => sum + column.value, 0),
    };
  }, [board]);

  const commitMove = (move: BoardMove, lostReason?: string) => {
    moveLead.mutate(
      {
        leadId: move.leadId,
        stageKey: move.toStageKey,
        precedingLeadId: move.precedingLeadId,
        ...(lostReason ? { lostReason } : {}),
      },
      {
        onError: (error) => {
          toast.error('Could not move the lead', {
            description:
              error instanceof ApiError ? error.message : 'Please check your connection.',
          });
        },
      },
    );
  };

  /**
   * Routes a move either straight to the server, or through the reason prompt
   * when it closes the lead as lost.
   */
  const requestMove = (move: BoardMove) => {
    const destination = stages.find((stage) => stage.key === move.toStageKey);
    const currentStage = board?.columns.find((column) =>
      column.leads.some((lead) => lead.id === move.leadId),
    )?.stage.key;

    if (destination?.type === 'LOST' && currentStage !== move.toStageKey) {
      setPendingLoss(move);
      return;
    }
    commitMove(move);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board || active.id === over.id) return;

    const move = resolveDrop(board, String(active.id), String(over.id));
    if (move) setPreview(applyBoardMove(board, move));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id);
    setActiveId(null);

    // With no preview the card never moved anywhere, so the drag was a no-op.
    if (!event.over || !preview || !boardQuery.data) {
      setPreview(null);
      return;
    }

    const before = positionOf(boardQuery.data, leadId);
    const after = positionOf(preview, leadId);
    setPreview(null);

    // Dragging a card around and dropping it back where it started should not
    // write to the database or land on the activity timeline.
    if (!after || isSamePosition(before, after)) return;
    requestMove(after);
  };

  const handleMoveToStage = (leadId: string, stageKey: StageKey) => {
    // From the card menu there is no drop position, so the lead goes to the top
    // of its new column — the same place a newly created lead lands.
    requestMove({ leadId, toStageKey: stageKey, precedingLeadId: null });
  };

  const isEmpty = board !== undefined && totals?.leads === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Pipeline"
        description={
          totals
            ? `${formatNumber(totals.leads)} leads · ${formatCurrency(totals.openValue, board?.currency ?? user.organization.defaultCurrency)} in open pipeline`
            : `Every deal in ${user.organization.name}, by stage.`
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New lead
          </Button>
        }
      />

      <BoardToolbar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        members={teamQuery.data ?? []}
      />

      {boardQuery.isError ? (
        <Card>
          <ErrorState
            error={boardQuery.error}
            onRetry={() => void boardQuery.refetch()}
            title="Could not load the pipeline"
          />
        </Card>
      ) : isEmpty ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title={hasActiveFilters ? 'No leads match these filters' : 'Your pipeline is empty'}
            description={
              hasActiveFilters
                ? 'Try widening your search, or clear the filters to see the whole board.'
                : 'Add your first enquiry and it will appear in the New column.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> New lead
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setPreview(null);
          }}
        >
          {/*
            One horizontal scroller holds all six columns. `snap-x` makes the
            swipe between columns land cleanly on a phone; the negative margin
            lets the scroll region run to the screen edge while the columns
            stay aligned with the page gutter.
          */}
          <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 scrollbar-slim">
            <div className="flex min-h-[60svh] items-stretch gap-3 sm:gap-4">
              {(board?.columns ?? []).map((column) => (
                <BoardColumn
                  key={column.stage.id}
                  column={column}
                  currency={board?.currency ?? user.organization.defaultCurrency}
                  stages={stages}
                  isLoading={boardQuery.isLoading}
                  isLoadingMore={
                    loadMore.isPending && loadMore.variables?.stageKey === column.stage.key
                  }
                  onLoadMore={() =>
                    loadMore.mutate({
                      stageKey: column.stage.key,
                      offset: column.leads.length,
                    })
                  }
                  onMoveToStage={handleMoveToStage}
                />
              ))}
            </div>
          </div>

          {/*
            The dragged card is rendered here rather than moved in place, so it
            can escape the column's `overflow` and follow the cursor across the
            whole board.
          */}
          <DragOverlay dropAnimation={null}>
            {activeLead && (
              <BoardCardOverlay
                lead={activeLead}
                currency={board?.currency ?? user.organization.defaultCurrency}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <LostReasonDialog
        open={pendingLoss !== null}
        leadName={
          board?.columns
            .flatMap((column) => column.leads)
            .find((lead) => lead.id === pendingLoss?.leadId)?.customerName
        }
        isPending={moveLead.isPending}
        onCancel={() => setPendingLoss(null)}
        onConfirm={(reason) => {
          if (pendingLoss) commitMove(pendingLoss, reason);
          setPendingLoss(null);
        }}
      />

      <LeadFormDialog
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        stages={stages}
        members={teamQuery.data ?? []}
        defaultCurrency={board?.currency ?? user.organization.defaultCurrency}
      />
    </div>
  );
}
