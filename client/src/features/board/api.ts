import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoardDto, LeadDetailDto, MoveLeadOnBoardInput, StageKey } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import type { BoardFilterState } from './hooks/use-board-filters';

/** Cards shown per column initially, and the step each "Show more" adds. */
export const BOARD_PAGE_SIZE = 40;

/**
 * @param limit cards per column. Raising it is how "Show more" works: the
 * depth is part of the request, so every refetch returns what the user already
 * had on screen. Holding extra pages in the cache instead meant the next
 * refresh — after a drag, on window focus — silently discarded them.
 */
export function useBoard(filters: BoardFilterState, limit: number) {
  return useQuery({
    queryKey: queryKeys.board.view({ ...filters, limit }),
    queryFn: () => api.get<BoardDto>('/board', { params: { ...filters, limit } }),
    // Keeps the previous board on screen while a filter change or a deeper page
    // loads, so the columns never collapse to empty and back.
    placeholderData: (previous) => previous,
  });
}

/** The board rearrangement a drop implies, applied to a cached `BoardDto`. */
export interface BoardMove {
  leadId: string;
  toStageKey: StageKey;
  /** The card the moved lead should sit directly below; `null` means the top. */
  precedingLeadId: string | null;
}

/**
 * Applies a move to a board snapshot.
 *
 * Exported because the same function serves two callers: the optimistic cache
 * write below, and the board page's live drag preview. One implementation means
 * what the user sees mid-drag and what the cache holds after the drop cannot
 * disagree.
 */
export function applyBoardMove(board: BoardDto, move: BoardMove): BoardDto {
  const lead = board.columns
    .flatMap((column) => column.leads)
    .find((entry) => entry.id === move.leadId);
  if (!lead) return board;

  const destination = board.columns.find((column) => column.stage.key === move.toStageKey);
  if (!destination) return board;

  const movedLead = { ...lead, stage: destination.stage };

  return {
    ...board,
    columns: board.columns.map((column) => {
      const without = column.leads.filter((entry) => entry.id !== move.leadId);
      const removed = without.length !== column.leads.length;

      if (column.stage.key !== move.toStageKey) {
        // Source column (or an untouched one): drop the card and its value.
        return removed
          ? {
              ...column,
              leads: without,
              total: column.total - 1,
              value: column.value - lead.estimatedValue,
            }
          : column;
      }

      const anchorIndex = move.precedingLeadId
        ? without.findIndex((entry) => entry.id === move.precedingLeadId)
        : -1;
      // A vanished anchor and "no anchor" both mean the top of the column,
      // matching how the server resolves the same request.
      const insertAt = anchorIndex + 1;

      return {
        ...column,
        leads: [...without.slice(0, insertAt), movedLead, ...without.slice(insertAt)],
        total: removed ? column.total : column.total + 1,
        value: removed ? column.value : column.value + lead.estimatedValue,
      };
    }),
  };
}

/**
 * Commits a drag-and-drop.
 *
 * The cache is updated in `onMutate` so the card stays exactly where the user
 * dropped it while the request is in flight — a board that snaps back for
 * 300ms and then jumps forward again feels broken even when it is correct. If
 * the server refuses the move the snapshot is restored and the card returns to
 * where it came from, which is the honest outcome.
 */
export function useMoveLeadOnBoard(filters: BoardFilterState, limit: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.board.view({ ...filters, limit });

  return useMutation({
    mutationFn: async ({ leadId, ...input }: MoveLeadOnBoardInput & { leadId: string }) =>
      (await api.post<{ lead: LeadDetailDto }>(`/leads/${leadId}/board-position`, input)).lead,

    onMutate: async (variables) => {
      // An in-flight refetch landing after the optimistic write would overwrite it.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardDto>(key);

      queryClient.setQueryData<BoardDto>(key, (board) =>
        board
          ? applyBoardMove(board, {
              leadId: variables.leadId,
              toStageKey: variables.stageKey,
              precedingLeadId: variables.precedingLeadId ?? null,
            })
          : board,
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: (_lead, _error, variables) => {
      // A stage change moves counts, aggregates and the lead's own timeline, so
      // every lead-derived view is refreshed rather than patched by hand.
      void queryClient.invalidateQueries({ queryKey: queryKeys.board.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leads.detail(variables.leadId),
      });
    },
  });
}
