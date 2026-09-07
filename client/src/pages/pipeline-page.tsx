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
import { BOARD_MAX_LIMIT, type BoardDto, type StageKey } from '@leadpilot/shared';
import { Plus, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/common/error-state';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTeamMembers } from '@/features/leads/api';
import { LeadFormDialog } from '@/features/leads/components/lead-form-dialog';
import {
  applyBoardMove,
  BOARD_PAGE_SIZE,
  useBoard,
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
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useBoardFilters();

  /*
   * How deep every column is loaded. "Show more" raises it and the board
   * refetches at the new depth, so the loaded cards survive every later
   * refresh. It resets whenever the filters change, because the depth someone
   * paged to on one view says nothing about the next.
   */
  const [limit, setLimit] = useState(BOARD_PAGE_SIZE);
  useEffect(() => setLimit(BOARD_PAGE_SIZE), [filters]);

  const boardQuery = useBoard(filters, limit);
  const teamQuery = useTeamMembers();
  const moveLead = useMoveLeadOnBoard(filters, limit);

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
          toast.error(t('lead.couldNotMove'), { description: describeError(error) });
        },
      },
    );
  };

  /**
   * Routes a move either straight to the server, or through the reason prompt
   * when it closes the lead as lost.
   *
   * @param fromStageKey the stage the lead was in *before* this gesture. It has
   * to be passed in rather than looked up: by the time a drag ends, `board` is
   * still the preview — the card has already been moved into the destination
   * column for the user to see — so asking it where the lead "currently" is
   * answers with the destination, the stage comparison below is Lost-to-Lost,
   * and dragging a deal into Lost silently closes it without ever asking why.
   */
  const requestMove = (move: BoardMove, fromStageKey: StageKey | undefined) => {
    const destination = stages.find((stage) => stage.key === move.toStageKey);

    if (destination?.type === 'LOST' && fromStageKey !== move.toStageKey) {
      setPendingLoss(move);
      return;
    }
    commitMove(move);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board || active.id === over.id) return;

    const leadId = String(active.id);
    const move = resolveDrop(board, leadId, String(over.id));
    if (!move) return;

    /*
     * Ignore a hover that would put the card exactly where it already sits.
     *
     * This is not just an optimisation. Dragging toward a column that is
     * scrolled off screen makes dnd-kit auto-scroll the board, every scroll
     * step re-fires dragOver, and writing an identical preview each time
     * re-triggers measurement — which scrolls again. That feedback loop ran
     * until React gave up with "Maximum update depth exceeded", and it was
     * reachable by the most ordinary gesture on the board: dragging a deal
     * rightwards into Won or Lost on a 1440px screen.
     */
    if (isSamePosition(move, positionOf(board, leadId))) return;

    setPreview(applyBoardMove(board, move));
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
    requestMove(after, before?.toStageKey);
  };

  const handleMoveToStage = (leadId: string, stageKey: StageKey) => {
    // From the card menu there is no drop position, so the lead goes to the top
    // of its new column — the same place a newly created lead lands.
    const from = boardQuery.data ? positionOf(boardQuery.data, leadId)?.toStageKey : undefined;
    requestMove({ leadId, toStageKey: stageKey, precedingLeadId: null }, from);
  };

  // Nothing matched. Deliberately *not* a reason to hide the board: the columns
  // are the screen. Replacing them with a single card takes away the stage
  // structure, every drop target, and any sense of what the filter excluded —
  // and it fires on a mistyped search, not only on an empty workspace.
  const isEmpty = board !== undefined && totals?.leads === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={t('board.title')}
        description={
          totals
            ? t('board.description', {
                leads: format.number(totals.leads),
                value: format.currency(
                  totals.openValue,
                  board?.currency ?? user.organization.defaultCurrency,
                ),
              })
            : t('board.fallbackDescription', { organization: user.organization.name })
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> {t('leads.newLead')}
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
            title={t('board.couldNotLoad')}
          />
        </Card>
      ) : (
        <>
          {isEmpty && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                aria-hidden
              >
                {hasActiveFilters ? <SearchX className="size-4" /> : <Plus className="size-4" />}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {hasActiveFilters ? t('board.noMatchTitle') : t('board.emptyTitle')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters ? t('board.noMatchBody') : t('board.emptyBody')}
                </p>
              </div>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  {t('common.clearFilters')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> {t('leads.newLead')}
                </Button>
              )}
            </div>
          )}

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
            <div className="scrollbar-slim -mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex min-h-[60svh] items-stretch gap-3 sm:gap-4">
                {(board?.columns ?? []).map((column) => (
                  <BoardColumn
                    key={column.stage.id}
                    column={column}
                    currency={board?.currency ?? user.organization.defaultCurrency}
                    stages={stages}
                    isLoading={boardQuery.isLoading}
                    // Only the columns actually waiting on more cards, so an
                    // ordinary refetch after a drag does not set every
                    // "show more" button spinning.
                    isLoadingMore={
                      boardQuery.isFetching && column.leads.length < Math.min(column.total, limit)
                    }
                    canLoadMore={limit < BOARD_MAX_LIMIT}
                    onLoadMore={() =>
                      setLimit((current) => Math.min(current + BOARD_PAGE_SIZE, BOARD_MAX_LIMIT))
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
        </>
      )}

      <LostReasonDialog
        open={pendingLoss !== null}
        title={t('board.markLostTitle', {
          name:
            board?.columns
              .flatMap((column) => column.leads)
              .find((lead) => lead.id === pendingLoss?.leadId)?.customerName ?? t('board.thisLead'),
        })}
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
