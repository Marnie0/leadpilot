import type { LeadStatsDto } from '@leadpilot/shared';
import { CircleDollarSign, CircleAlert, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat, useT } from '@/lib/i18n';
import { MoneyTotal } from '@/components/common/money-total';
import { cn } from '@/lib/utils';

interface StatDefinition {
  key: string;
  label: string;
  /**
   * A node rather than a string: a money figure may render as a breakdown of
   * two or three currencies stacked, which no amount of string formatting
   * fits into one line of a card this size.
   */
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning';
}

const TONE_STYLES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-destructive/10 text-destructive',
} as const;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: Omit<StatDefinition, 'key'>) {
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
  isLoading,
}: {
  stats: LeadStatsDto | undefined;
  isLoading: boolean;
}) {
  const t = useT();
  const format = useFormat();

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
      key: 'open',
      label: t('leads.stat.open'),
      value: format.number(stats.openLeads),
      hint: t('leads.stat.openHint', { total: format.number(stats.totalLeads) }),
      icon: Users,
    },
    {
      key: 'pipeline',
      label: t('leads.stat.pipelineValue'),
      value: <MoneyTotal total={stats.totalPipelineValue} className="text-xl sm:text-2xl" />,
      hint: t('leads.stat.pipelineValueHint'),
      icon: CircleDollarSign,
    },
    {
      key: 'won',
      label: t('leads.stat.won'),
      value: <MoneyTotal total={stats.wonValue} className="text-xl sm:text-2xl" />,
      hint:
        winRate === null
          ? t('leads.stat.wonHintNoRate', { count: format.number(stats.wonLeads) })
          : t('leads.stat.wonHint', { count: format.number(stats.wonLeads), rate: winRate }),
      icon: Trophy,
      tone: 'success',
    },
    {
      key: 'overdue',
      label: t('leads.stat.overdue'),
      value: format.number(stats.overdueFollowUps),
      hint:
        stats.overdueFollowUps > 0 ? t('leads.stat.overdueHint') : t('leads.stat.nothingOverdue'),
      icon: CircleAlert,
      tone: stats.overdueFollowUps > 0 ? 'warning' : 'default',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ key, ...card }) => (
        <StatCard key={key} {...card} />
      ))}
    </div>
  );
}
