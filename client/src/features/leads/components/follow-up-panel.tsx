import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FOLLOW_UP_CHANNELS,
  createFollowUpSchema,
  type CreateFollowUpFormValues,
  type CreateFollowUpInput,
  type FollowUpDto,
} from '@leadpilot/shared';
import { CalendarClock, Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';
import { cn } from '@/lib/utils';
import { useCancelFollowUp, useCompleteFollowUp, useCreateFollowUp } from '../api';

/** Default a new follow-up to 10:00 tomorrow — the most common real answer. */
function defaultDueAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function FollowUpRow({ followUp, leadId }: { followUp: FollowUpDto; leadId: string }) {
  const t = useT();
  const format = useFormat();
  const complete = useCompleteFollowUp(leadId);
  const cancel = useCancelFollowUp(leadId);
  const due = format.dueDate(followUp.dueAt);
  const isPending = followUp.status === 'PENDING';

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        followUp.status === 'COMPLETED' && 'bg-muted/40',
        due.tone === 'overdue' && isPending && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            dir="auto"
            className={cn(
              'text-sm font-medium text-foreground',
              followUp.status !== 'PENDING' && 'text-muted-foreground line-through',
            )}
          >
            {followUp.title}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {t(`channel.${followUp.channel}`)}
          </Badge>
          {followUp.status === 'CANCELLED' && (
            <Badge variant="secondary" className="text-[10px]">
              {t('followUp.cancelled')}
            </Badge>
          )}
        </div>

        <p
          className={cn(
            'text-xs',
            isPending && due.tone === 'overdue'
              ? 'font-medium text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {isPending
            ? due.label
            : t('followUp.completedAt', { date: format.dateTime(followUp.completedAt) })}
          {followUp.assignedTo && ` · ${followUp.assignedTo.name}`}
        </p>

        {followUp.notes && (
          <p className="text-xs text-muted-foreground" dir="auto">
            {followUp.notes}
          </p>
        )}
      </div>

      {isPending && (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('followUp.markComplete', { title: followUp.title })}
            disabled={complete.isPending}
            onClick={() => {
              complete.mutate(
                { id: followUp.id },
                {
                  onSuccess: () => toast.success(t('followUp.completed')),
                  onError: () => toast.error(t('followUp.couldNotComplete')),
                },
              );
            }}
          >
            {complete.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={t('followUp.cancelOne', { title: followUp.title })}
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate(followUp.id, {
                onSuccess: () => toast.success(t('followUp.wasCancelled')),
                onError: () => toast.error(t('followUp.couldNotCancel')),
              });
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

export function FollowUpPanel({
  leadId,
  followUps,
  isLoading,
  error,
  onRetry,
}: {
  leadId: string;
  followUps: FollowUpDto[];
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const [isAdding, setAdding] = useState(false);
  const createFollowUp = useCreateFollowUp(leadId);

  const form = useForm<CreateFollowUpFormValues, unknown, CreateFollowUpInput>({
    resolver: useLocalizedResolver(zodResolver(createFollowUpSchema)),
    defaultValues: {
      title: '',
      dueAt: new Date(defaultDueAt()).toISOString(),
      channel: 'CALL',
      notes: '',
    },
  });

  const onSubmit = async (values: CreateFollowUpInput) => {
    try {
      await createFollowUp.mutateAsync(values);
      toast.success(t('followUp.scheduled'));
      form.reset({
        title: '',
        dueAt: new Date(defaultDueAt()).toISOString(),
        channel: 'CALL',
        notes: '',
      });
      setAdding(false);
    } catch (error) {
      toast.error(t('followUp.couldNotSchedule'), { description: describeError(error) });
    }
  };

  const pending = followUps.filter((entry) => entry.status === 'PENDING');
  const past = followUps.filter((entry) => entry.status !== 'PENDING');

  return (
    <div className="space-y-4">
      {!isAdding && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t('followUp.schedule')}
        </Button>
      )}

      {isAdding && (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3 rounded-lg border bg-muted/30 p-3"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="followup-title" className="text-xs">
              {t('followUp.whatNeedsDoing')}
            </Label>
            <Input
              id="followup-title"
              placeholder={t('followUp.titlePlaceholder')}
              className="h-9"
              aria-invalid={Boolean(form.formState.errors.title)}
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="followup-due" className="text-xs">
                {t('followUp.due')}
              </Label>
              <Input
                id="followup-due"
                type="datetime-local"
                className="h-9"
                defaultValue={defaultDueAt()}
                onChange={(event) => {
                  const date = new Date(event.target.value);
                  form.setValue('dueAt', Number.isNaN(date.getTime()) ? '' : date.toISOString(), {
                    shouldValidate: true,
                  });
                }}
                aria-invalid={Boolean(form.formState.errors.dueAt)}
              />
              {form.formState.errors.dueAt && (
                <p className="text-xs text-destructive">{form.formState.errors.dueAt.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="followup-channel" className="text-xs">
                {t('followUp.channel')}
              </Label>
              <Select
                defaultValue="CALL"
                onValueChange={(value) =>
                  form.setValue('channel', value as CreateFollowUpFormValues['channel'])
                }
              >
                <SelectTrigger id="followup-channel" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {t(`channel.${channel}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="followup-notes" className="text-xs">
              {t('followUp.notes')}
            </Label>
            <Textarea
              id="followup-notes"
              rows={2}
              placeholder={t('followUp.notesPlaceholder')}
              {...form.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                form.reset();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {t('followUp.submit')}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} title={t('followUp.couldNotLoad')} />
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : followUps.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('followUp.emptyTitle')}
          description={t('followUp.emptyBody')}
          className="py-8"
        />
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map((followUp) => (
                <FollowUpRow key={followUp.id} followUp={followUp} leadId={leadId} />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t('followUp.past')}
              </p>
              <ul className="space-y-2">
                {past.map((followUp) => (
                  <FollowUpRow key={followUp.id} followUp={followUp} leadId={leadId} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
