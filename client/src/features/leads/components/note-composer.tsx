import { useState } from 'react';
import { USER_ACTIVITY_TYPES, type UserActivityType } from '@leadpilot/shared';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import { useCreateActivity } from '../api';

const MAX_LENGTH = 4000;

/**
 * Note and interaction logger.
 *
 * The type selector doubles as the log-a-call/email affordance, so a rep records
 * what happened in one field instead of navigating to a separate form.
 */
export function NoteComposer({ leadId }: { leadId: string }) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const [body, setBody] = useState('');
  const [type, setType] = useState<UserActivityType>('NOTE');
  const createActivity = useCreateActivity(leadId);

  const trimmed = body.trim();
  const isTooLong = trimmed.length > MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !isTooLong && !createActivity.isPending;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      await createActivity.mutateAsync({ type, body: trimmed });
      setBody('');
      setType('NOTE');
      toast.success(t('composer.added'));
    } catch (error) {
      toast.error(t('composer.couldNotSave'), { description: describeError(error) });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="activity-body" className="sr-only">
          {t('composer.label')}
        </Label>
        <Textarea
          id="activity-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // ⌘/Ctrl+Enter submits — the convention for a multi-line composer.
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              void submit(event);
            }
          }}
          placeholder={t('composer.placeholder')}
          rows={3}
          className="resize-y"
          aria-invalid={isTooLong}
        />
        {isTooLong && (
          <p className="text-sm text-destructive">
            {t('composer.tooLong', { count: trimmed.length - MAX_LENGTH })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={t('composer.entryType')}
        >
          {USER_ACTIVITY_TYPES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => setType(option)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                type === option
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t(`activityType.${option}`)}
            </button>
          ))}
        </div>

        <Button type="submit" size="sm" className="ms-auto" disabled={!canSubmit}>
          {createActivity.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {t('composer.submit')}
        </Button>
      </div>
    </form>
  );
}
