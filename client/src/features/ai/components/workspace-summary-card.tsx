import type { AiSeverity, AiTrend, WorkspaceSummaryDto } from '@leadpilot/shared';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useFormat, useI18n, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import {
  useDeleteWorkspaceSummary,
  useGenerateWorkspaceSummary,
  useWorkspaceSummary,
} from '../api';

/**
 * The assistant's read of the whole workspace.
 *
 * Sits at the top of the dashboard because that is the screen people open to
 * ask "how are we doing", and this answers the half of that question the charts
 * cannot: which specific things need somebody today.
 *
 * Every state it can be in mirrors the per-lead card — off, not configured, no
 * budget left, provider failing, stale — deliberately, so the two features
 * behave identically under failure and a user learns the pattern once.
 */

const SEVERITY_STYLES: Record<AiSeverity, string> = {
  URGENT: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  WATCH: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  INFO: 'border-transparent bg-muted text-muted-foreground',
};

const TREND_ICONS: Record<AiTrend, typeof TrendingUp> = {
  UP: TrendingUp,
  DOWN: TrendingDown,
  FLAT: Minus,
};

const TREND_TONES: Record<AiTrend, string> = {
  UP: 'text-emerald-600 dark:text-emerald-400',
  DOWN: 'text-red-600 dark:text-red-400',
  FLAT: 'text-muted-foreground',
};

function Body({ summary }: { summary: WorkspaceSummaryDto }) {
  const t = useT();
  const format = useFormat();

  return (
    // The language the briefing was written in — see the note in
    // `lead-insight-card.tsx` for why this is not the page's language.
    <div className="space-y-5" lang={summary.locale}>
      <p className="text-sm text-foreground" dir="auto">
        {summary.headline}
      </p>

      {summary.attention.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('aiSummary.attention')}
          </p>
          <ul className="space-y-2">
            {summary.attention.map((item, index) => (
              <li
                key={`${item.title}-${index}`}
                className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:gap-3"
              >
                <span
                  className={cn(
                    'inline-flex w-fit shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-medium',
                    SEVERITY_STYLES[item.severity],
                  )}
                >
                  {t(`aiSeverity.${item.severity}`)}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium text-foreground" dir="auto">
                    {item.title}
                  </span>
                  {item.detail && (
                    <span className="block text-xs text-muted-foreground" dir="auto">
                      {item.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.trends.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('aiSummary.trends')}
          </p>
          <ul className="space-y-1.5">
            {summary.trends.map((trend, index) => {
              const Icon = TREND_ICONS[trend.direction];
              return (
                <li key={`${trend.title}-${index}`} className="flex items-start gap-2 text-sm">
                  <Icon
                    className={cn('mt-0.5 size-4 shrink-0', TREND_TONES[trend.direction])}
                    aria-hidden
                  />
                  <span className="min-w-0" dir="auto">
                    <span className="font-medium text-foreground">{trend.title}</span>
                    {trend.detail && (
                      <span className="block text-xs text-muted-foreground">{trend.detail}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 space-y-0.5">
          <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('aiSummary.nextStep')}
          </span>
          <span className="block text-sm font-medium text-foreground" dir="auto">
            {summary.nextStep}
          </span>
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {summary.generatedBy
          ? t('ai.by', {
              time: format.relative(summary.generatedAt),
              name: summary.generatedBy.name,
            })
          : t('ai.byUnknown', { time: format.relative(summary.generatedAt) })}
      </p>
    </div>
  );
}

function Notice({
  tone = 'muted',
  title,
  body,
  action,
}: {
  tone?: 'muted' | 'warning';
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2',
        tone === 'warning'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          : 'bg-muted/50 text-muted-foreground',
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium">{title}</p>
        {body && <p className="text-xs opacity-90">{body}</p>}
      </div>
      {action}
    </div>
  );
}

function WorkingState() {
  const t = useT();
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('aiSummary.working')}
      </p>
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

export function WorkspaceSummaryCard() {
  const t = useT();
  const { locale } = useI18n();
  const user = useCurrentUser();
  const describeError = useApiErrorMessage();

  const query = useWorkspaceSummary();
  const generate = useGenerateWorkspaceSummary();
  const remove = useDeleteWorkspaceSummary();

  const summary = query.data?.summary ?? null;
  const usage = query.data?.usage;
  const isManager = user.role === 'OWNER' || user.role === 'ADMIN';
  const isBusy = generate.isPending;
  const quotaSpent = (usage?.remaining ?? 0) <= 0;

  const header = (
    <CardHeader className="flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
        {t('aiSummary.title')}
      </CardTitle>
      {usage?.enabled && usage.configured && summary && usage.remaining > 0 && (
        <span className="text-xs text-muted-foreground">
          {t('ai.remaining', { count: usage.remaining })}
        </span>
      )}
    </CardHeader>
  );

  const shell = (children: React.ReactNode) => (
    <Card>
      {header}
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (query.isLoading) {
    return shell(
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>,
    );
  }

  if (query.error) {
    return shell(
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title={t('aiSummary.failedTitle')}
      />,
    );
  }

  if (usage && !usage.configured) {
    return shell(
      <EmptyState
        icon={Wand2}
        title={t('ai.unconfiguredTitle')}
        description={t('ai.unconfiguredBody')}
        className="py-8"
      />,
    );
  }

  if (usage && !usage.enabled) {
    return shell(
      <EmptyState
        icon={Wand2}
        title={t('ai.offTitle')}
        description={t('ai.offBody')}
        className="py-8"
        action={
          isManager ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">{t('ai.offOwnerHint')}</Link>
            </Button>
          ) : undefined
        }
      />,
    );
  }

  const runButton = (label: string, variant: 'default' | 'outline' = 'default') => (
    <Button
      variant={variant}
      size="sm"
      disabled={isBusy || quotaSpent}
      onClick={() =>
        generate.mutate(locale, {
          onError: (error) =>
            toast.error(t('aiSummary.failedTitle'), { description: describeError(error) }),
        })
      }
    >
      {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {label}
    </Button>
  );

  // Same rule as the per-lead card: a failed run is stated on the card, in both
  // the empty and the populated branch, rather than only as a toast that goes.
  const failureNotice = generate.isError && (
    <Notice
      tone="warning"
      title={t('aiSummary.failedTitle')}
      body={describeError(generate.error)}
      action={
        !quotaSpent ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isBusy}
            onClick={() => generate.mutate(locale)}
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {t('common.tryAgain')}
          </Button>
        ) : undefined
      }
    />
  );

  if (!summary) {
    if (isBusy) return shell(<WorkingState />);
    return shell(
      <div className="space-y-4">
        {failureNotice}
        <EmptyState
          icon={Sparkles}
          title={t('aiSummary.emptyTitle')}
          description={t('aiSummary.emptyBody')}
          className="py-8"
          action={
            <div className="space-y-2">
              {runButton(t('aiSummary.generate'))}
              {quotaSpent && usage && (
                <p className="text-xs text-muted-foreground">
                  {t('ai.quotaSpentBody', { count: usage.dailyLimit })}
                </p>
              )}
            </div>
          }
        />
      </div>,
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        {failureNotice}

        {summary.isStale && !generate.isError && (
          <Notice
            tone="warning"
            title={t('aiSummary.staleTitle')}
            body={t('aiSummary.staleBody')}
          />
        )}

        {summary.locale !== locale && !summary.isStale && !generate.isError && (
          <Notice title={t('ai.otherLanguageTitle')} body={t('ai.otherLanguageBody')} />
        )}

        {quotaSpent && usage && (
          <Notice
            title={t('ai.quotaSpentTitle')}
            body={t('ai.quotaSpentBody', { count: usage.dailyLimit })}
          />
        )}

        {isBusy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('aiSummary.working')}
          </p>
        )}

        {/* Dimmed rather than replaced while a re-run is in flight — the same
            rule the lead card and the lists follow. */}
        <div
          className={cn('transition-opacity', isBusy && 'pointer-events-none opacity-45')}
          aria-busy={isBusy}
        >
          <Body summary={summary} />
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex max-w-[26rem] items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('aiSummary.disclaimer')}
          </p>
          <div className="flex items-center gap-1">
            {isManager && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                disabled={remove.isPending || isBusy}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => toast.success(t('aiSummary.discarded')),
                    onError: (error) =>
                      toast.error(t('ai.couldNotDiscard'), { description: describeError(error) }),
                  })
                }
              >
                {remove.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {t('ai.discard')}
              </Button>
            )}
            {runButton(t('aiSummary.regenerate'), 'outline')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
