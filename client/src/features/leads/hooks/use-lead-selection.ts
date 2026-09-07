import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeadListItemDto } from '@leadpilot/shared';

export interface LeadSelection {
  selected: ReadonlySet<string>;
  count: number;
  ids: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
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
   */
  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const present = new Set(selectableIds);
      const next = new Set([...current].filter((id) => present.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectableIds]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      current.size >= selectableIds.length ? new Set() : new Set(selectableIds),
    );
  }, [selectableIds]);

  const allState: boolean | 'indeterminate' =
    selected.size === 0 ? false : selected.size >= selectableIds.length ? true : 'indeterminate';

  return {
    selected,
    count: selected.size,
    ids: useMemo(() => [...selected], [selected]),
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    clear,
    toggleAll,
    allState,
    hasSelectable: selectableIds.length > 0,
  };
}
