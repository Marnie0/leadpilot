import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MONEY_VIEWS, type MoneyView } from '@leadpilot/shared';

/**
 * How this reader wants mixed-currency totals shown.
 *
 * ## Why this is local, when the display *currency* is on the user record
 *
 * The two look like the same kind of setting and are not. The display currency
 * changes what the browser asks for — it rides along on every aggregate request
 * as `?display=` — so the server has to be able to answer for a user who has
 * not told it anything yet, and the profile is the right place for that.
 *
 * This one changes nothing about the request. Every total already arrives
 * carrying both readings (see `MoneyTotalDto`), so switching between them is a
 * re-render, not a refetch. That makes it exactly the same shape of preference
 * as the theme: pure presentation, instant, and nobody else's business. So it
 * lives where the theme lives.
 */

const STORAGE_KEY = 'leadpilot.moneyView';

interface MoneyViewContextValue {
  moneyView: MoneyView;
  setMoneyView: (view: MoneyView) => void;
}

const MoneyViewContext = createContext<MoneyViewContextValue | null>(null);

function readStored(): MoneyView {
  if (typeof window === 'undefined') return 'CONVERTED';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (MONEY_VIEWS.includes(stored as MoneyView)) return stored as MoneyView;
  } catch {
    // Private browsing or blocked storage — the default is a fine answer.
  }
  // Converted by default: it is the reading that works on every workspace,
  // including the great majority that only ever hold one currency and would
  // find a "breakdown" of one row baffling.
  return 'CONVERTED';
}

export function MoneyViewProvider({ children }: { children: React.ReactNode }) {
  const [moneyView, setState] = useState<MoneyView>(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, moneyView);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }, [moneyView]);

  const setMoneyView = useCallback((view: MoneyView) => setState(view), []);
  const value = useMemo(() => ({ moneyView, setMoneyView }), [moneyView, setMoneyView]);

  return <MoneyViewContext.Provider value={value}>{children}</MoneyViewContext.Provider>;
}

export function useMoneyView(): MoneyViewContextValue {
  const context = useContext(MoneyViewContext);
  if (!context) throw new Error('useMoneyView must be used inside MoneyViewProvider');
  return context;
}
