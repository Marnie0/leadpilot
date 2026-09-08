import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AiUsageDto, LeadInsightDto } from '@leadpilot/shared';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { AI_BAND_STYLES, AI_URGENCY_STYLES } from '@/lib/labels';
import { useFormat, useI18n, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import { useDeleteInsight, useGenerateInsight, useLeadInsight } from '../api';

/**
 * The assistant's read of one lead.
 *
 * ## Why this card never breaks the page
 *
 * There are eight ways this can fail to show an analysis — the workspace has
 * the assistant off, the deployment has no key, the daily budget is spent, the
 * provider is throttling, the provider is down, the model answered with
 * nonsense, the lead is archived, or the read itself failed — and each one is a
 * different sentence with a different action. None of them is a blank card or a
 * spinner that never resolves.
 *
 * The rule that keeps it honest: **a stored analysis is never replaced by an
 * error.** If a re-run fails, the failure appears as a banner above the
 * analysis the user was already reading, rather than the card emptying out to
 * report it. Losing yesterday's assessment because today's refresh timed out
 * would be the worst possible reading of "handle the error state".
 */

function ScoreBar({ score, band }: { score: number; band: LeadInsightDto['qualityBand'] }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn('h-full rounded-full transition-all', AI_BAND_STYLES[band].bar)}
        style={{ inlineSize: `${Math.max(2, score)}%` }}
      />
    </div>
  );
}

/** A banner that sits above an analysis without discarding it. */
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

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={async () => {
        try {
          // `navigator.clipboard` is unavailable over plain HTTP on a LAN
          // address, which is exactly how somebody demos this from a phone.
          // Failing with an instruction beats failing silently.
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(t('ai.copied'));
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(t('ai.copyFailed'));
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {t('ai.copy')}
    </Button>
  );
}

function Analysis({ insight }: { insight: LeadInsightDto }) {
  const t = useT();
  const format = useFormat();
  const band = AI_BAND_STYLES[insight.qualityBand];

  return (
    /*
     * `lang` is set to the language the analysis was *written* in, which is not
     * always the language the page is in — an English analysis stays readable
     * on an Arabic screen, and the card says so.
     *
     * Without this a screen reader announces English prose using Arabic
     * pronunciation rules, which is somewhere between comic and unintelligible.
     * It pairs with the `dir="auto"` already on each block: `dir` decides which
     * way the text runs, `lang` decides how it is spoken and hyphenated.
     */
    <div className="space-y-5" lang={insight.locale}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('ai.quality')}
            </p>
            <p className={cn('text-sm font-semibold tabular-nums', band.text)}>
              {/* The number is decorative next to the bar, but it is the thing a
                  screen reader should read, so the accessible name is the whole
                  sentence rather than a bare figure. */}
              <span className="sr-only">{t('ai.scoreOutOf', { score: insight.qualityScore })}</span>
              <span aria-hidden>{format.number(insight.qualityScore)}</span>
            </p>
          </div>
          <ScoreBar score={insight.qualityScore} band={insight.qualityBand} />
        </div>

        <div className="space-y-2 sm:text-end">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('ai.urgencyLabel')}
          </p>
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
              AI_URGENCY_STYLES[insight.urgency],
            )}
          >
            {t(`aiUrgency.${insight.urgency}`)}
          </span>
        </div>
      </div>

      <p className="text-sm text-foreground" dir="auto">
        {insight.summary}
      </p>

      <p className="text-sm text-muted-foreground" dir="auto">
        {insight.rationale}
      </p>

      {insight.signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('ai.signals')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {insight.signals.map((signal) => (
              <Badge key={signal} variant="secondary" className="text-xs font-normal" dir="auto">
                {signal}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('ai.nextStep')}
        </p>
        <p className="text-sm font-medium text-foreground" dir="auto">
          {insight.nextAction}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('ai.draftVia', { channel: t(`channel.${insight.nextActionChannel}`) })}
          </p>
          <CopyButton text={insight.draftMessage} />
        </div>
        {/*
          `whitespace-pre-wrap` because the model writes paragraphs, and
          `dir="auto"` because an Arabic draft has to lay itself out correctly
          even while the app is being read in English.
        */}
        <p
          className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap text-foreground"
          dir="auto"
        >
          {insight.draftMessage}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {insight.generatedBy
          ? t('ai.by', {
              time: format.relative(insight.generatedAt),
              name: insight.generatedBy.name,
            })
          : t('ai.byUnknown', { time: format.relative(insight.generatedAt) })}
      </p>
    </div>
  );
}

/** The "the model is working" line. It takes a few seconds, so it has to exist. */
function WorkingLine() {
  const t = useT();
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {t('ai.analyzing')}
    </p>
  );
}

/** Skeleton for the *first* analysis, when there is nothing to keep on screen. */
function AnalysingState() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <WorkingLine />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

/**
 * Why a lead cannot be analysed, when it cannot.
 *
 * A single boolean was not enough: "this lead is in the trash" and "this lead
 * is not yours" are both read-only, and telling somebody the wrong one of those
 * is worse than telling them nothing. Reading an analysis stays open to the
 * whole workspace either way — only running one is restricted.
 */
export type InsightBlock = 'archived' | 'notYours' | null;

export function LeadInsightCard({
  leadId,
  block,
}: {
  leadId: string;
  /** Null when the reader may run an analysis on this lead. */
  block: InsightBlock;
}) {
  const canGenerate = block === null;
  const t = useT();
  const { locale } = useI18n();
  const user = useCurrentUser();
  const describeError = useApiErrorMessage();

  const query = useLeadInsight(leadId);
  const generate = useGenerateInsight(leadId);
  const remove = useDeleteInsight(leadId);

  const insight = query.data?.insight ?? null;
  const usage: AiUsageDto | undefined = query.data?.usage;
  const isManager = user.role === 'OWNER' || user.role === 'ADMIN';

  const header = (
    <CardHeader className="flex-row items-center justify-between gap-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <Sparkles className="size-4 text-muted-foreground" aria-hidden />
        {t('ai.title')}
      </CardTitle>
      {usage?.enabled && usage.configured && insight && usage.remaining > 0 && (
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
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>,
    );
  }

  if (query.error) {
    return shell(
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title={t('ai.failedTitle')}
      />,
    );
  }

  // The operator has not set the feature up. Nothing the user can do, so it
  // says so plainly rather than offering a button that would always fail.
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

  // Switched off for this workspace. A manager gets sent somewhere useful; a
  // rep is told who can change it rather than shown a link they cannot act on.
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

  const quotaSpent = (usage?.remaining ?? 0) <= 0;
  const isBusy = generate.isPending;

  /**
   * A failed run, stated on the card.
   *
   * Rendered in *both* the empty and the populated branch. It only lived in the
   * populated one at first, which meant a lead's very first analysis failing
   * left the card looking exactly as it had before — the toast said what
   * happened and then disappeared, and what remained was a button that gave no
   * sign it had already been pressed. The first failure is the one most likely
   * to be somebody's whole impression of the feature.
   */
  const failureNotice = generate.isError && (
    <Notice
      tone="warning"
      title={t('ai.failedTitle')}
      body={describeError(generate.error)}
      action={
        canGenerate && !quotaSpent ? (
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

  const runButton = (label: string, variant: 'default' | 'outline' = 'default') => (
    <Button
      variant={variant}
      size="sm"
      disabled={isBusy || quotaSpent || !canGenerate}
      onClick={() => {
        generate.mutate(locale, {
          onError: (error) =>
            toast.error(t('ai.failedTitle'), { description: describeError(error) }),
        });
      }}
    >
      {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {label}
    </Button>
  );

  if (!insight) {
    if (isBusy) return shell(<AnalysingState />);
    return shell(
      <div className="space-y-4">
        {failureNotice}
        <EmptyState
          icon={Sparkles}
          title={t('ai.emptyTitle')}
          description={t('ai.emptyBody')}
          className="py-8"
          action={
            <div className="space-y-2">
              {runButton(t('ai.analyze'))}
              {block && (
                <p className="text-xs text-muted-foreground">
                  {block === 'archived' ? t('ai.notForArchived') : t('ai.notYours')}
                </p>
              )}
              {canGenerate && quotaSpent && usage && (
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
        {/*
          Order matters: a failed re-run is the most recent thing that happened
          and the only one with an action attached, so it goes first. The
          staleness and language notices are about the analysis below them.
        */}
        {failureNotice}

        {insight.isStale && !generate.isError && (
          <Notice
            tone="warning"
            title={t('ai.staleTitle')}
            body={canGenerate ? t('ai.staleBody') : undefined}
          />
        )}

        {insight.locale !== locale && !insight.isStale && !generate.isError && (
          <Notice
            title={t('ai.otherLanguageTitle')}
            body={canGenerate ? t('ai.otherLanguageBody') : undefined}
          />
        )}

        {quotaSpent && canGenerate && usage && (
          <Notice
            title={t('ai.quotaSpentTitle')}
            body={t('ai.quotaSpentBody', { count: usage.dailyLimit })}
          />
        )}

        {/*
          A re-run keeps the previous analysis on screen, dimmed, rather than
          swapping it for a skeleton. It is the same rule the lead and follow-up
          lists follow while they refetch: the answer you already have is more
          use for the four seconds it takes than an empty box is, and you may
          well be part-way through reading the draft you just asked to replace.
          The first analysis has no such content, so that one does get a skeleton.
        */}
        {isBusy && <WorkingLine />}
        <div
          className={cn('transition-opacity', isBusy && 'pointer-events-none opacity-45')}
          aria-busy={isBusy}
        >
          <Analysis insight={insight} />
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex max-w-[26rem] items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('ai.disclaimer')}
          </p>
          {canGenerate && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                disabled={remove.isPending || isBusy}
                onClick={() => {
                  remove.mutate(undefined, {
                    onSuccess: () => toast.success(t('ai.discarded')),
                    onError: (error) =>
                      toast.error(t('ai.couldNotDiscard'), { description: describeError(error) }),
                  });
                }}
              >
                {remove.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {t('ai.discard')}
              </Button>
              {runButton(t('ai.reanalyze'), 'outline')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
