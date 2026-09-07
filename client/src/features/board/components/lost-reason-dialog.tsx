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
 * Confirmation shown when a card is dropped into a Lost stage.
 *
 * Asked *before* the move rather than after, which is why the card snaps back
 * while this is open: until the question is answered nothing has happened, and
 * a card sitting in Lost behind an unanswered dialog would claim otherwise.
 *
 * The reason is optional. "Why did we lose this" is the single most useful
 * thing to capture at that moment and nobody ever goes back to add it later,
 * but making it mandatory would just teach people to type "n/a".
 */
export function LostReasonDialog({
  open,
  leadName,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string | undefined;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | undefined) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');

  // Each prompt starts blank; a reason typed for one lead must not be carried
  // into the next one the user happens to lose.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('board.markLostTitle', { name: leadName ?? t('board.thisLead') })}
          </DialogTitle>
          <DialogDescription>{t('lead.markLostBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="board-lost-reason">{t('lead.lostReasonLabel')}</Label>
          <Textarea
            id="board-lost-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder={t('lead.lostReasonPlaceholder')}
            maxLength={280}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t('lead.markAsLost')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
