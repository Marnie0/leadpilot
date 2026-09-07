import type { LeadStatsDto } from '@leadpilot/shared';
import { CircleDollarSign, CircleAlert, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface StatDefinition {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning';
}

const TONE_STYLES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-destructive/10 text-destructive',
} as const;

function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: StatDefinition) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          {/*
            The number is the entire point of the card, so it must never be
            clipped. At 390px in a two-up grid, `text-2xl` plus the icon left
            too little room and values rendered as "AED 4…".
          */}
          <p className="text-xl font-semibold text-foreground tabular-nums sm:text-2xl">{value}</p>
          {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
        </div>
        {/* Decorative: dropped on the narrowest screens to give the value its width back. */}
        <span
          className={cn(
            'hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex',
            TONE_STYLES[tone],
          )}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
      </div>
    </Card>
  );
}

/**
 * Summary row above the leads table.
 *
 * These aggregate the *filtered* set, not the whole workspace, so the numbers
 * always describe what is on screen.
 */
export function LeadStats({
  stats,
  currency,
  isLoading,
}: {
  stats: LeadStatsDto | undefined;
  currency: string;
  isLoading: boolean;
}) {
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const winRate =
    stats.wonLeads + stats.lostLeads > 0
      ? Math.round((stats.wonLeads / (stats.wonLeads + stats.lostLeads)) * 100)
      : null;

  const cards: StatDefinition[] = [
    {
      label: 'Open leads',
      value: formatNumber(stats.openLeads),
      hint: `${formatNumber(stats.totalLeads)} total in view`,
      icon: Users,
    },
    {
      label: 'Pipeline value',
      value: formatCurrency(stats.totalPipelineValue, currency),
      hint: 'Estimated value of open leads',
      icon: CircleDollarSign,
    },
    {
      label: 'Won',
      value: formatCurrency(stats.wonValue, currency),
      hint:
        winRate === null
          ? `${formatNumber(stats.wonLeads)} deals closed`
          : `${formatNumber(stats.wonLeads)} deals · ${winRate}% win rate`,
      icon: Trophy,
      tone: 'success',
    },
    {
      label: 'Overdue follow-ups',
      value: formatNumber(stats.overdueFollowUps),
      hint: stats.overdueFollowUps > 0 ? 'Needs attention today' : 'Nothing overdue',
      icon: CircleAlert,
      tone: stats.overdueFollowUps > 0 ? 'warning' : 'default',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
