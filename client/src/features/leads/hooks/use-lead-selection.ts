import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LeadListItemDto } from '@leadpilot/shared';

export interface LeadSelection {
  selected: ReadonlySet<string>;
  count: number;
  ids: string[];
  /**
   * True once anything is selected — the table is in "selection mode" and a
   * click on a row picks it rather than opening it.
   */
  isActive: boolean;
  isSelected: (id: string) => boolean;
  /**
   * Toggles one row, or with `extend` selects everything between the last row
   * touched and this one.
   */
  toggle: (id: string, options?: { extend?: boolean }) => void;
  clear: () => void;
  /**
   * Narrows the selection to exactly these ids, or clears it when given none.
   * Used after a bulk action to leave the rows it could not change in view.
   */
  retain: (ids: string[]) => void;
  /** Selects every selectable row on the page, or clears them if all are on. */
  toggleAll: () => void;
  /** `true` when every selectable row is selected, `'some'` when only a few are. */
  allState: boolean | 'indeterminate';
  /** No row on this page can be acted on — the header checkbox is pointless. */
  hasSelectable: boolean;
}

/**
 * Which leads the table has selected.
 *
 * ## Page-scoped, deliberately
 *
 * The selection is cleared whenever the filters or the page change. Carrying
 * ids across pages sounds generous and is a trap: you end up archiving thirty
 * leads you cannot see, having only ever looked at ten. Everything the bulk bar
 * offers to do is visible on screen at the moment you ask for it.
 *
 * ## Only what the viewer may change
 *
 * A rep can read every lead in the workspace but only edit their own, so rows
 * they cannot act on are not selectable at all. The alternative — letting them
 * select anything and quietly dropping most of it server-side — teaches people
 * their selection means less than it says.
 */
export function useLeadSelection(leads: LeadListItemDto[], resetKey: unknown): LeadSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  /** Where a shift-click measures from. */
  const anchor = useRef<string | null>(null);

  useEffect(() => {
    setSelected((current) => (current.size === 0 ? current : new Set()));
  }, [resetKey]);

  const selectableIds = useMemo(
    () => leads.filter((lead) => lead.canEdit).map((lead) => lead.id),
    [leads],
  );

  /*
   * Drop anything no longer on the page.
   *
   * A bulk action refetches the list, and a lead that was archived or filtered
   * out by the change is gone from it. Leaving its id in the set would keep the
   * action bar claiming a count the table cannot show.
   *
   * The test is presence, not selectability. A lead can enter the selection
   * while it is yours to edit and stop being yours a moment later — reassigned
   * by someone else — and that is exactly the row a bulk action reports back as
   * refused. Pruning on `canEdit` would silently drop the one row the user
   * needs to see.
   */
  const pageIds = useMemo(() => leads.map((lead) => lead.id).join(','), [leads]);
  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const present = new Set(pageIds ? pageIds.split(',') : []);
      const next = new Set([...current].filter((id) => present.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [pageIds]);

  const toggle = useCallback(
    (id: string, { extend = false }: { extend?: boolean } = {}) => {
      setSelected((current) => {
        /*
         * Shift-click fills in the range from the last row touched.
         *
         * It *adds* the range rather than toggling each row in it, which is
         * what every table that does this behaves like: dragging a shift-click
         * back and forth should widen and narrow one block, not invert
         * whatever it passes over.
         */
        const from = anchor.current;
        if (extend && from && from !== id) {
          const start = selectableIds.indexOf(from);
          const end = selectableIds.indexOf(id);
          if (start !== -1 && end !== -1) {
            const [lo, hi] = start < end ? [start, end] : [end, start];
            const next = new Set(current);
            for (const rangeId of selectableIds.slice(lo, hi + 1)) next.add(rangeId);
            anchor.current = id;
            return next;
          }
        }

        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        anchor.current = id;
        return next;
      });
    },
    [selectableIds],
  );

  const clear = useCallback(() => {
    anchor.current = null;
    setSelected(new Set());
  }, []);

  const retain = useCallback((ids: string[]) => {
    anchor.current = null;
    setSelected(new Set(ids));
  }, []);

  const toggleAll = useCallback(() => {
    anchor.current = null;
    setSelected((current) =>
      current.size >= selectableIds.length ? new Set() : new Set(selectableIds),
    );
  }, [selectableIds]);

  /*
   * Measured against the rows the header checkbox can actually reach. The
   * selection may also hold rows that have since become read-only, and counting
   * those would tick "select all" while some selectable rows were still
   * unticked.
   */
  const selectedSelectable = selectableIds.filter((id) => selected.has(id)).length;
  const allState: boolean | 'indeterminate' =
    selectedSelectable === 0
      ? false
      : selectedSelectable >= selectableIds.length
        ? true
        : 'indeterminate';

  /*
   * Escape leaves selection mode.
   *
   * Guarded on anything else that owns the key first: a dialog, a dropdown or a
   * select is closed by Escape too, and dismissing the archive confirmation
   * should not also throw away the selection it was about to act on.
   */
  useEffect(() => {
    if (selected.size === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected.size, clear]);

  return {
    selected,
    count: selected.size,
    isActive: selected.size > 0,
    ids: useMemo(() => [...selected], [selected]),
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    clear,
    retain,
    toggleAll,
    allState,
    hasSelectable: selectableIds.length > 0,
  };
}
