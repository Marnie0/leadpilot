import type { DashboardDeltaDto } from '@leadpilot/shared';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Headline figure with an optional comparison against the previous window.
 *
 * The delta is deliberately not colour-coded green-good / red-bad on every
 * card: "average days to close" going *up* is bad, and a component that assumes
 * otherwise quietly lies. `higherIsBetter` makes each caller state which
 * direction it means.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  higherIsBetter = true,
  tone = 'default',
  explainer,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  delta?: DashboardDeltaDto | null;
  higherIsBetter?: boolean;
  tone?: 'default' | 'success' | 'warning';
  /** Shown in a tooltip on the label — how the figure is actually calculated. */
  explainer?: string;
}) {
  const change = delta?.changePct ?? null;
  const isFlat = change !== null && Math.abs(change) < 0.5;
  const isGood = change === null ? null : higherIsBetter ? change > 0 : change < 0;

  const TrendIcon = change === null || isFlat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {explainer ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="w-fit cursor-help text-xs font-medium tracking-wide text-muted-foreground uppercase decoration-dotted underline-offset-4 hover:underline">
                  {label}
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{explainer}</TooltipContent>
            </Tooltip>
          ) : (
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
          )}

          {/* The number is the point of the card, so it must never be clipped. */}
          <p className="text-xl font-semibold text-foreground tabular-nums sm:text-2xl">{value}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {delta && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  change === null || isFlat
                    ? 'text-muted-foreground'
                    : isGood
                      ? 'text-success'
                      : 'text-destructive',
                )}
              >
                <TrendIcon className="size-3.5" aria-hidden />
                {change === null
                  ? 'No prior data'
                  : isFlat
                    ? 'Flat'
                    : `${Math.abs(change).toFixed(0)}%`}
              </span>
            )}
            {hint && <span className="leading-snug text-muted-foreground">{hint}</span>}
          </div>
        </div>

        {/* Decorative: dropped on the narrowest screens to give the value its width. */}
        <span
          className={cn(
            'hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex',
            tone === 'success'
              ? 'bg-success/10 text-success'
              : tone === 'warning'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary',
          )}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
      </div>
    </Card>
  );
}

export function KpiCardSkeleton() {
  return <Skeleton className="h-[110px] rounded-xl" />;
}
