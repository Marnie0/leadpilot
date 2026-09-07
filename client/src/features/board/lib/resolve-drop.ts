import { arrayMove } from '@dnd-kit/sortable';
import type { BoardDto } from '@leadpilot/shared';
import type { BoardMove } from '../api';

/**
 * Turns "card A is hovering over B" into the move the API expects.
 *
 * `overId` is either a lead id (the user is over another card) or a stage key
 * (the user is over a column's empty space). Both are handled here so the page
 * component never has to know which kind of droppable it is dealing with.
 *
 * Returns `null` when the drop is a no-op or the ids cannot be resolved —
 * callers treat that as "nothing happened", which is what a drag that ends
 * where it started should do.
 */
export function resolveDrop(
  board: BoardDto,
  activeId: string,
  overId: string,
): BoardMove | null {
  const sourceColumn = board.columns.find((column) =>
    column.leads.some((lead) => lead.id === activeId),
  );
  if (!sourceColumn) return null;

  const overColumn = board.columns.find((column) => column.stage.key === overId);

  if (overColumn) {
    // Over a column's background — usually because it is empty, or because the
    // pointer is below the last card. Either way the intent is "put it at the
    // bottom of this column".
    const last = overColumn.leads.filter((lead) => lead.id !== activeId).at(-1);
    return {
      leadId: activeId,
      toStageKey: overColumn.stage.key,
      precedingLeadId: last?.id ?? null,
    };
  }

  const targetColumn = board.columns.find((column) =>
    column.leads.some((lead) => lead.id === overId),
  );
  if (!targetColumn) return null;

  const ids = targetColumn.leads.map((lead) => lead.id);

  if (targetColumn.stage.key === sourceColumn.stage.key) {
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from === -1 || to === -1 || from === to) return null;

    // `arrayMove` is what gives a within-column drag its expected feel: the card
    // lands *after* the one it was dragged past going down, and *before* it
    // going up. Reimplementing that from the hovered index alone gets the
    // downward case subtly wrong.
    const reordered = arrayMove(ids, from, to);
    const landedAt = reordered.indexOf(activeId);
    return {
      leadId: activeId,
      toStageKey: targetColumn.stage.key,
      precedingLeadId: reordered[landedAt - 1] ?? null,
    };
  }

  // Crossing columns: take the hovered card's place, pushing it down.
  const to = ids.indexOf(overId);
  return {
    leadId: activeId,
    toStageKey: targetColumn.stage.key,
    precedingLeadId: ids[to - 1] ?? null,
  };
}

/**
 * Reads a lead's current position out of a board snapshot as a move.
 *
 * This is how a drop is committed. It is tempting to run `resolveDrop` again on
 * release, but by then the live preview has already slid the card under the
 * cursor, so the element being hovered is the dragged card itself — and
 * resolving "put A next to A" against the server's untouched board produces no
 * move at all. Reading the position back out of the preview instead asks the
 * only question that matters: where does the user see the card now.
 */
export function positionOf(board: BoardDto, leadId: string): BoardMove | null {
  const column = board.columns.find((entry) =>
    entry.leads.some((lead) => lead.id === leadId),
  );
  if (!column) return null;

  const index = column.leads.findIndex((lead) => lead.id === leadId);
  return {
    leadId,
    toStageKey: column.stage.key,
    precedingLeadId: column.leads[index - 1]?.id ?? null,
  };
}

/** True when two positions describe the same slot — a drag that changed nothing. */
export function isSamePosition(a: BoardMove | null, b: BoardMove | null): boolean {
  return (
    a !== null &&
    b !== null &&
    a.toStageKey === b.toStageKey &&
    a.precedingLeadId === b.precedingLeadId
  );
}
