import { comparableAmount, type MoneyTotalDto } from '@leadpilot/shared';
import { useFormat } from '@/lib/i18n';
import { useMoneyView } from '@/providers/money-view-provider';
import { cn } from '@/lib/utils';

/**
 * A sum of money that may span currencies.
 *
 * ## The two readings, and why both are shown from one payload
 *
 * `CONVERTED` is one figure: every currency restated at today's rate and added.
 * Comparable, sortable, and slightly wrong at the edges, because a rate is a
 * moment's opinion about a number nobody has actually exchanged.
 *
 * `BREAKDOWN` is several figures with nothing added across them. Every one of
 * them is exactly true, and no total is claimed that the workspace could not
 * point at in a bank account.
 *
 * The server sends both on every total, so the switch is a re-render. That also
 * means the two can never disagree: the converted figure is derived from the
 * same per-currency numbers the breakdown lists.
 *
 * ## What it does when there is only one currency
 *
 * One figure in both modes: the great majority of workspaces trade in one
 * currency and should never be shown a "breakdown" of a single row. Which
 * currency that figure is in follows the payload. The server draws every total
 * in the reader's display currency (`total.currency`) and keeps the original
 * beside it in `byCurrency`; when the two agree nothing was converted and the
 * original is shown as it is. When they differ the reader asked to read the
 * workspace in another currency, and the converted view honours that here
 * exactly as the single-figure KPIs and charts on the same screen do —
 * otherwise a dashboard footnoted "in USD, converted from AED" would show
 * dollars in one card and dirhams in the next. The breakdown view still shows
 * the original, because that is what a breakdown is.
 */
export function MoneyTotal({
  total,
  precise = false,
  className,
  /** Renders the breakdown inline rather than stacked — for tight table cells. */
  inline = false,
}: {
  total: MoneyTotalDto;
  precise?: boolean;
  className?: string;
  inline?: boolean;
}) {
  const format = useFormat();
  const { moneyView } = useMoneyView();

  // Nothing at all. Rendering `0` in the reader's currency is honest and is
  // what every caller wants here — an empty stage is worth zero, not unknown.
  if (total.byCurrency.length === 0) {
    return (
      <span className={cn('tabular-nums', className)}>
        {format.currency(0, total.currency, { precise })}
      </span>
    );
  }

  const single = total.byCurrency.length === 1 ? total.byCurrency[0] : null;

  // One currency, and it is the one the total was drawn in: nothing to convert
  // and nothing to break down, in either view.
  if (single && !total.mixed && single.currency === total.currency) {
    return (
      <span className={cn('tabular-nums', className)}>
        {format.currency(single.amount, single.currency, { precise })}
      </span>
    );
  }

  // `converted` is null when rates could not be resolved for a mixed total.
  // Falling through to the breakdown is the honest answer: it needs no rate and
  // is exactly true, where any single figure here would be a guess.
  if (moneyView === 'CONVERTED' && total.converted !== null) {
    return (
      <span className={cn('tabular-nums', className)}>
        {format.currency(total.converted, total.currency, { precise })}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'tabular-nums',
        inline ? 'inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5' : 'flex flex-col gap-0.5',
        className,
      )}
    >
      {total.byCurrency.map((entry) => (
        <span key={entry.currency}>
          {format.currency(entry.amount, entry.currency, { precise })}
        </span>
      ))}
    </span>
  );
}

/**
 * The same thing as a plain string.
 *
 * For the handful of places that interpolate a total into a sentence — a page
 * header's description, a toast — where a component cannot go. A breakdown
 * joins with a separator rather than stacking, because it has to read as one
 * line inside somebody else's paragraph.
 */
export function useMoneyTotalText(): (total: MoneyTotalDto, precise?: boolean) => string {
  const format = useFormat();
  const { moneyView } = useMoneyView();

  return (total, precise = false) => {
    if (total.byCurrency.length === 0) return format.currency(0, total.currency, { precise });

    const single = total.byCurrency.length === 1 ? total.byCurrency[0] : null;
    if (single && !total.mixed && single.currency === total.currency) {
      return format.currency(single.amount, single.currency, { precise });
    }
    if (moneyView === 'CONVERTED' && total.converted !== null) {
      return format.currency(total.converted, total.currency, { precise });
    }
    return total.byCurrency
      .map((entry) => format.currency(entry.amount, entry.currency, { precise }))
      .join(' · ');
  };
}

/**
 * The single number a chart axis or a sort comparator needs.
 *
 * A chart cannot plot a breakdown, so anything drawn on one uses the converted
 * figure regardless of the reader's view — which is why the charts carry their
 * own "converted to X" note rather than relying on the switch.
 */
export const moneyValue = (total: MoneyTotalDto): number => comparableAmount(total);
