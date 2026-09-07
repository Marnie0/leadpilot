import { ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Chart chrome, shared by every panel on the dashboard.
 *
 * ## Colour
 *
 * Recharts writes `fill` and `stroke` as SVG *presentation attributes*, where
 * `var(--token)` is not valid — so the app's CSS variables cannot be handed to
 * it directly. Two things get around that without duplicating the palette in
 * JavaScript and letting it drift from the theme:
 *
 *  - Structural elements (grid lines, axes) use `stroke="currentColor"` with a
 *    Tailwind text colour on the element, which resolves the token through CSS.
 *  - Data series use `SERIES` below, or the stage's own hex from the database.
 *    Those five are chosen to hold up on both the light and dark backgrounds,
 *    so they need no theme switch.
 *
 * The tooltip is a plain React component rather than Recharts' default, so it
 * inherits the app's tokens like anything else.
 *
 * ## Direction
 *
 * Recharts knows nothing about `dir`. It lays out SVG by absolute coordinate,
 * so an Arabic chart would keep its category axis running left-to-right while
 * every label beside it ran the other way — the graph would read backwards
 * against its own text. `useChartDirection` returns the handful of props that
 * mirror it: axes swap sides, the category order reverses, and the bar corner
 * radii follow. It is applied per chart rather than globally because "which
 * end is the start" is a question only each chart can answer.
 */

/** Axis and geometry props that have to flip when the document is RTL. */
export function useChartDirection() {
  const { isRtl } = useI18n();

  return {
    isRtl,
    /** Categories run from the reading-start edge. */
    categoryAxis: { reversed: isRtl } as const,
    /** The value axis sits on the reading-end side. */
    valueAxisSide: (isRtl ? 'right' : 'left') as 'left' | 'right',
    /** Rounds the growing end of a horizontal bar. */
    horizontalBarRadius: (isRtl ? [3, 0, 0, 3] : [0, 3, 3, 0]) as [number, number, number, number],
    /**
     * Trims the gutter the value axis no longer needs. Recharts' margin is
     * physical, so the negative inset has to move with the axis.
     */
    axisMargin: (value: number) => (isRtl ? { right: value, left: 8 } : { left: value, right: 8 }),
  };
}

/** Series colours. Fixed hexes: legible on both themes, no runtime lookup. */
export const SERIES = {
  created: '#6366f1',
  won: '#10b981',
  value: '#0ea5e9',
  neutral: '#94a3b8',
} as const;

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-4 overflow-hidden', className)}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      {/* `flex-1` so a chart asked to fill can grow into the height the card
          gets from its taller neighbour in the grid, instead of leaving a band
          of empty card underneath it. */}
      <CardContent className="flex min-w-0 flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}

/**
 * Responsive wrapper with a concrete height.
 *
 * `ResponsiveContainer` measures its parent, so the height has to resolve to
 * something real — handed a percentage of an auto-height parent it collapses to
 * zero and the chart silently does not render at all.
 *
 * @param height a pixel height, or `'fill'` to take whatever the card has
 * spare (still with a floor, for the same reason).
 */
export function ChartFrame({
  height = 260,
  children,
}: {
  height?: number | 'fill';
  children: React.ReactElement;
}) {
  const fill = height === 'fill';
  return (
    <div
      style={fill ? undefined : { height }}
      className={cn('w-full text-border', fill && 'min-h-[260px] flex-1')}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number | 'fill' }) {
  return (
    <Skeleton
      className={cn('w-full rounded-lg', height === 'fill' && 'min-h-[260px] flex-1')}
      style={height === 'fill' ? undefined : { height }}
    />
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Themed tooltip body. Callers map their own payload into rows. */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-sm">
            {row.color && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
            )}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ms-auto font-medium tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shared axis styling, so every chart's ticks look the same. */
export const AXIS_PROPS = {
  stroke: 'currentColor',
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: 'currentColor' },
  className: 'text-muted-foreground',
} as const;
