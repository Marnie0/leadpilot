import { Link } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { BoardColumnDto, PipelineStageDto, StageKey } from '@leadpilot/shared';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stageName } from '@/lib/labels';
import { useFormat, useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { BOARD_PAGE_SIZE } from '../api';
import { BoardCard, BoardCardSkeleton } from './board-card';

/**
 * One pipeline stage.
 *
 * The column is a droppable in its own right as well as a sortable list, which
 * is what lets a card be dropped into an *empty* column — a sortable list with
 * no items has nothing to collide with, so without this the Won column would
 * silently reject the first deal anyone tried to close.
 */
export function BoardColumn({
  column,
  currency,
  stages,
  isLoading,
  isLoadingMore,
  canLoadMore,
  onLoadMore,
  onMoveToStage,
}: {
  column: BoardColumnDto;
  currency: string;
  stages: PipelineStageDto[];
  isLoading: boolean;
  isLoadingMore: boolean;
  /** False once the board has hit its ceiling; the table takes over from there. */
  canLoadMore: boolean;
  onLoadMore: () => void;
  onMoveToStage: (leadId: string, stageKey: StageKey) => void;
}) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const { setNodeRef, isOver } = useDroppable({
    id: column.stage.key,
    data: { type: 'column', stageKey: column.stage.key },
  });

  const leadIds = column.leads.map((lead) => lead.id);
  const hasMore = column.leads.length < column.total;
  const name = stageName(column.stage, locale);

  return (
    <section
      className="flex w-[280px] shrink-0 snap-start flex-col sm:w-[300px]"
      aria-label={t('board.columnLabel', { stage: name, count: format.number(column.total) })}
    >
      <header className="mb-2 flex items-center gap-2 px-1">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: column.stage.color }}
          aria-hidden
        />
        <h2 className="truncate text-sm font-semibold text-foreground">{name}</h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {format.number(column.total)}
        </span>
        <span className="ms-auto shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {format.currency(column.value, currency)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[140px] flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors',
          isOver ? 'border-primary/50 bg-primary/5' : 'border-transparent bg-muted/40',
        )}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {isLoading && column.leads.length === 0 ? (
            Array.from({ length: 3 }, (_, index) => <BoardCardSkeleton key={index} />)
          ) : column.leads.length === 0 ? (
            <p className="flex flex-1 items-center justify-center px-3 py-6 text-center text-xs text-muted-foreground">
              {isOver ? t('board.dropHere') : t('board.stageEmpty')}
            </p>
          ) : (
            column.leads.map((lead) => (
              <BoardCard
                key={lead.id}
                lead={lead}
                currency={currency}
                stages={stages}
                onMoveToStage={(stageKey) => onMoveToStage(lead.id, stageKey)}
              />
            ))
          )}
        </SortableContext>

        {hasMore &&
          (canLoadMore ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
              {t('board.showMore', {
                count: format.number(Math.min(column.total - column.leads.length, BOARD_PAGE_SIZE)),
              })}
              <span className="text-muted-foreground/70">
                {t('board.loadedOf', {
                  shown: format.number(column.leads.length),
                  total: format.number(column.total),
                })}
              </span>
            </Button>
          ) : (
            // Past the board's ceiling, more cards stop being useful. The table
            // is built for this many records — sorting, paging, bulk scanning —
            // so the column hands over rather than pretending to be one.
            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
              <Link to={`/leads?stage=${column.stage.key}`}>
                {t('board.viewAllInTable', { count: format.number(column.total) })}
                {/* Points away to another screen, so it follows the reading direction. */}
                <ArrowUpRight className="icon-directional size-3.5" />
              </Link>
            </Button>
          ))}
      </div>
    </section>
  );
}
