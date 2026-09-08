import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CalendarClock,
  Check,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { FollowUpChannel, FollowUpDto } from '@leadpilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import {
  useCancelFollowUpById,
  useCompleteFollowUpById,
  usePurgeFollowUp,
  useRescheduleFollowUp,
  useRestoreFollowUp,
  useTrashFollowUp,
} from '../api';
import { CompleteFollowUpDialog } from './complete-dialog';
import { ConfirmPurgeDialog } from './confirm-purge-dialog';
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
  const trash = useTrashFollowUp();
  const restore = useRestoreFollowUp();
  const purge = usePurgeFollowUp();

  const [dialog, setDialog] = useState<'complete' | 'reschedule' | 'purge' | null>(null);

  const isTrashed = followUp.deletedAt !== null;
  const isPending = followUp.status === 'PENDING';
  const canEdit = followUp.canEdit !== false;
  const due = format.dueDate(followUp.dueAt);
  const ChannelIcon = CHANNEL_ICONS[followUp.channel];
  const busy =
    complete.isPending ||
    cancel.isPending ||
    reschedule.isPending ||
    trash.isPending ||
    restore.isPending ||
    purge.isPending;

  const fail = (message: string) => (error: unknown) =>
    toast.error(message, { description: describeError(error) });

  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4 sm:px-6',
        isPending && !isTrashed && due.tone === 'overdue' && 'bg-destructive/[0.04]',
        (!isPending || isTrashed) && 'bg-muted/25',
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
              (!isPending || isTrashed) && 'text-muted-foreground line-through',
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
          {isTrashed && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {t('bucket.trash')}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={cn('font-normal', isPending ? TONE_STYLES[due.tone] : TONE_STYLES.none)}
          >
            {isTrashed
              ? t('followUp.deletedWhen', { when: format.relative(followUp.deletedAt) })
              : isPending
                ? due.label
                : followUp.status === 'COMPLETED'
                  ? t('followUp.wasCompletedBy', { when: format.dateTime(followUp.completedAt) })
                  : t('followUp.wasCancelledOn')}
          </Badge>

          {followUp.lead && (
            <>
              <span aria-hidden>·</span>
              {/* The customer, not the company. Sorting by "Customer" against a
                  column showing company names looked like no sort at all — and
                  the person is the lead's identity anyway; the company is
                  context, so it follows in muted text. */}
              <Link
                to={`/leads/${followUp.lead.id}`}
                dir="auto"
                className="rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {followUp.lead.customerName}
              </Link>
              {followUp.lead.company && (
                <span dir="auto" className="text-muted-foreground">
                  {followUp.lead.company}
                </span>
              )}
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

      <div className="flex shrink-0 items-center gap-1 self-start">
        {!canEdit ? (
          /* A read-only row still says why, rather than simply having no
             buttons where every other row has some. */
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
        ) : isTrashed ? (
          /* In the trash the only two questions are "did I mean that" and
             "am I sure" — completing or rescheduling something deleted is not
             an action anybody wants. */
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={busy}
                  aria-label={t('followUp.restore')}
                  onClick={() =>
                    restore.mutate(followUp.id, {
                      onSuccess: () => toast.success(t('followUp.restored')),
                      onError: fail(t('followUp.couldNotRestore')),
                    })
                  }
                >
                  <RotateCcw className="icon-directional size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('followUp.restore')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  aria-label={t('followUp.deleteForeverTitle', { title: followUp.title })}
                  onClick={() => setDialog('purge')}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('followUp.deleteForever')}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {isPending && (
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
              </>
            )}

            {/* Cancel and delete move into a menu rather than becoming a fourth
                and fifth icon: they are the two a mis-click would hurt, and a
                row of five identical ghost buttons is where mis-clicks come
                from. Delete stays reachable on a finished follow-up, which is
                the one that most often turns out to be a mistake. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  disabled={busy}
                  aria-label={t('followUp.more')}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isPending && (
                  <DropdownMenuItem
                    onSelect={() =>
                      cancel.mutate(followUp.id, {
                        onSuccess: () => toast.success(t('followUp.wasCancelled')),
                        onError: fail(t('followUp.couldNotCancel')),
                      })
                    }
                  >
                    <Ban className="size-4" aria-hidden /> {t('followUp.cancelAction')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    trash.mutate(followUp.id, {
                      onSuccess: () => toast.success(t('followUp.deleted')),
                      onError: fail(t('followUp.couldNotDelete')),
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden /> {t('followUp.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

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

      <ConfirmPurgeDialog
        open={dialog === 'purge'}
        title={followUp.title}
        isPending={purge.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          purge.mutate(followUp.id, {
            onSuccess: () => {
              setDialog(null);
              toast.success(t('followUp.deletedForever'));
            },
            onError: fail(t('followUp.couldNotDeleteForever')),
          })
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
