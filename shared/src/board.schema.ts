import { z } from 'zod';
import { STAGE_KEYS } from './enums.js';
import { idSchema, optionalTrimmed } from './common.js';
import { leadQuerySchema, type LeadListItemDto, type PipelineStageDto } from './lead.schema.js';

/**
 * Ceiling on cards per column.
 *
 * A Kanban column is not a list view: nobody scans two hundred cards, and
 * loading them makes the board slower for everyone who does not need them.
 * Past this the UI stops offering "show more" and points at the leads table,
 * which is the right tool for that many records.
 */
export const BOARD_MAX_LIMIT = 200;

/**
 * The board reuses the table's filters so a narrowed table and a narrowed board
 * mean the same thing, minus the parts that make no sense on a Kanban view:
 *
 *  - `stage` — the board *is* the stage breakdown; filtering it out would empty
 *    columns rather than filter cards.
 *  - `archived` — archived leads have no place on a working board.
 *  - `page` / `pageSize` / `sortBy` / `sortDir` — the board is always ordered by
 *    the manual rank within each stage, and depth is controlled by `limit`.
 */
export const boardQuerySchema = leadQuerySchema
  .omit({ page: true, pageSize: true, sortBy: true, sortDir: true, stage: true, archived: true })
  .extend({
    /**
     * Cards to load per column.
     *
     * One number for the whole board rather than a per-column cursor. "Show
     * more" raises it and the board refetches, which means the loaded depth is
     * part of the request instead of state accumulated in the client — so a
     * refetch (after a drag, on window focus, on any invalidation) returns the
     * same cards the user was already looking at. Appending pages into the
     * cache instead looked cheaper and silently threw those pages away the
     * next time anything refreshed the board.
     */
    limit: z.coerce.number().int().min(1).max(BOARD_MAX_LIMIT).default(40),
  });
export type BoardQueryInput = z.infer<typeof boardQuerySchema>;

/**
 * Repositions a lead on the board, optionally moving it to another stage.
 *
 * Position is expressed as an *anchor* rather than an index: "put this card
 * immediately below `precedingLeadId`". An index would be wrong whenever the
 * column is only partially loaded — index 5 of the 40 cards on screen is not
 * index 5 of the 300 in the stage — whereas an anchor means the same thing
 * either way, and stays meaningful if someone else reorders the column
 * between the drag starting and the request landing.
 */
export const moveLeadOnBoardSchema = z.object({
  stageKey: z.enum(STAGE_KEYS),
  /** `null` places the lead at the top of the column. */
  precedingLeadId: idSchema.nullish(),
  /** Only read when the destination stage is a LOST stage. */
  lostReason: optionalTrimmed(280),
});
export type MoveLeadOnBoardInput = z.infer<typeof moveLeadOnBoardSchema>;

/* ------------------------------------------------------------------ *
 * Response DTOs
 * ------------------------------------------------------------------ */

export interface BoardColumnDto {
  stage: PipelineStageDto;
  /** The loaded slice, in board order. May be shorter than `total`. */
  leads: LeadListItemDto[];
  /** Every lead matching the current filters in this stage, loaded or not. */
  total: number;
  /** Summed estimated value across all `total` leads, not just the loaded ones. */
  value: number;
}

export interface BoardDto {
  columns: BoardColumnDto[];
  /** Cards per column the server applied, echoed so the client can page. */
  limit: number;
  /** Workspace currency. Every lead uses it, so the board formats money once. */
  currency: string;
}
