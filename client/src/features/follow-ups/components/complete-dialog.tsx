import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n';

/**
 * Asks what happened before marking a follow-up done.
 *
 * The outcome is optional and the dialog says so. What it is *for* is the fact
 * that this is the one moment somebody knows the answer: "left a voicemail,
 * trying again Thursday" written here lands on the lead's timeline, and written
 * nowhere means the next person to open that lead starts from nothing.
 */
export function CompleteFollowUpDialog({
  open,
  title,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (outcome: string | undefined) => void;
}) {
  const t = useT();
  const [outcome, setOutcome] = useState('');

  // Blank per prompt, so an outcome typed for one task never follows another.
  useEffect(() => {
    if (open) setOutcome('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="auto">{t('followUp.completeTitle', { title })}</DialogTitle>
          <DialogDescription>{t('followUp.completeBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="follow-up-outcome">{t('followUp.outcome')}</Label>
          <Textarea
            id="follow-up-outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            rows={3}
            placeholder={t('followUp.outcomePlaceholder')}
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button disabled={isPending} onClick={() => onConfirm(outcome.trim() || undefined)}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t('followUp.completeAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
