import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CalendarClock,
  Check,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FollowUpChannel, FollowUpDto } from '@leadpilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import { useCancelFollowUpById, useCompleteFollowUpById, useRescheduleFollowUp } from '../api';
import { CompleteFollowUpDialog } from './complete-dialog';
import { RescheduleDialog } from './reschedule-dialog';

const CHANNEL_ICONS: Record<FollowUpChannel, LucideIcon> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  OTHER: CalendarClock,
};

/** Badge tint for the due descriptor, so urgency reads before the words do. */
const TONE_STYLES = {
  overdue: 'border-destructive/30 bg-destructive/10 text-destructive',
  today: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  soon: 'border-transparent bg-muted text-muted-foreground',
  later: 'border-transparent bg-muted text-muted-foreground',
  none: 'border-transparent bg-muted text-muted-foreground',
} as const;

/**
 * One follow-up in the inbox.
 *
 * The three actions are the three things a person does with a task they are
 * looking at: it happened, it needs to move, it is not happening. Anything
 * more — editing the title, changing the channel — belongs on the lead, where
 * the context that would justify the edit is also on screen.
 */
export function FollowUpRow({ followUp }: { followUp: FollowUpDto }) {
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();

  const complete = useCompleteFollowUpById();
  const cancel = useCancelFollowUpById();
  const reschedule = useRescheduleFollowUp();

  const [dialog, setDialog] = useState<'complete' | 'reschedule' | null>(null);

  const isPending = followUp.status === 'PENDING';
  const canEdit = followUp.canEdit !== false;
  const due = format.dueDate(followUp.dueAt);
  const ChannelIcon = CHANNEL_ICONS[followUp.channel];
  const busy = complete.isPending || cancel.isPending || reschedule.isPending;

  const fail = (message: string) => (error: unknown) =>
    toast.error(message, { description: describeError(error) });

  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4 sm:px-6',
        isPending && due.tone === 'overdue' && 'bg-destructive/[0.04]',
        !isPending && 'bg-muted/25',
      )}
    >
      <span
        className={cn(
          'hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex',
          isPending && due.tone === 'overdue'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <ChannelIcon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            dir="auto"
            className={cn(
              'text-sm font-medium text-foreground',
              !isPending && 'text-muted-foreground line-through',
            )}
          >
            {followUp.title}
          </p>
          <Badge variant="outline" className="text-[10px] font-normal">
            {t(`channel.${followUp.channel}`)}
          </Badge>
          {followUp.status === 'CANCELLED' && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {t('followUp.wasCancelledOn')}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={cn('font-normal', isPending ? TONE_STYLES[due.tone] : TONE_STYLES.none)}
          >
            {isPending
              ? due.label
              : followUp.status === 'COMPLETED'
                ? t('followUp.wasCompletedBy', { when: format.dateTime(followUp.completedAt) })
                : t('followUp.wasCancelledOn')}
          </Badge>

          {followUp.lead && (
            <>
              <span aria-hidden>·</span>
              <Link
                to={`/leads/${followUp.lead.id}`}
                dir="auto"
                className="rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {followUp.lead.company ?? followUp.lead.customerName}
              </Link>
            </>
          )}

          {followUp.assignedTo && (
            <>
              <span aria-hidden>·</span>
              <span dir="auto">
                {t('followUp.assignedToLabel', { name: followUp.assignedTo.name })}
              </span>
            </>
          )}
        </div>

        {followUp.notes && (
          <p className="text-xs text-muted-foreground" dir="auto">
            {followUp.notes}
          </p>
        )}
      </div>

      {isPending && (
        <div className="flex shrink-0 items-center gap-1 self-start">
          {canEdit ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={busy}
                    aria-label={t('followUp.markComplete', { title: followUp.title })}
                    onClick={() => setDialog('complete')}
                  >
                    <Check className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('followUp.completeAction')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={busy}
                    aria-label={t('followUp.rescheduleTitle', { title: followUp.title })}
                    onClick={() => setDialog('reschedule')}
                  >
                    <CalendarClock className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('followUp.reschedule')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={busy}
                    aria-label={t('followUp.cancelOne', { title: followUp.title })}
                    onClick={() =>
                      cancel.mutate(followUp.id, {
                        onSuccess: () => toast.success(t('followUp.wasCancelled')),
                        onError: fail(t('followUp.couldNotCancel')),
                      })
                    }
                  >
                    <Ban className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('followUp.cancelAction')}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            /* A read-only row still says why, rather than simply having no
               buttons where every other row has three. */
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="flex size-8 items-center justify-center text-muted-foreground/60"
                  tabIndex={0}
                  role="note"
                  aria-label={t('followUp.locked')}
                >
                  <Lock className="size-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('followUp.locked')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      <CompleteFollowUpDialog
        open={dialog === 'complete'}
        title={followUp.title}
        isPending={complete.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={(outcome) =>
          complete.mutate(
            { id: followUp.id, ...(outcome && { outcome }) },
            {
              onSuccess: () => {
                setDialog(null);
                toast.success(t('followUp.completed'));
              },
              onError: fail(t('followUp.couldNotComplete')),
            },
          )
        }
      />

      <RescheduleDialog
        open={dialog === 'reschedule'}
        title={followUp.title}
        dueAt={followUp.dueAt}
        isPending={reschedule.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={(dueAt) =>
          reschedule.mutate(
            { id: followUp.id, dueAt },
            {
              onSuccess: () => {
                setDialog(null);
                toast.success(t('followUp.rescheduled'));
              },
              onError: fail(t('followUp.couldNotReschedule')),
            },
          )
        }
      />
    </li>
  );
}
