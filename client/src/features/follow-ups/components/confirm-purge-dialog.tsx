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
import { useT } from '@/lib/i18n';

/**
 * The one confirmation in the follow-up inbox, for the one action that cannot
 * be undone. Deleting to the trash asks nothing — it is reversible, and a
 * prompt on a reversible action just teaches people to dismiss prompts.
 */
export function ConfirmPurgeDialog({
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
  onConfirm: () => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="auto">{t('followUp.deleteForeverTitle', { title })}</DialogTitle>
          <DialogDescription>{t('followUp.deleteForeverBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t('followUp.deleteForever')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
