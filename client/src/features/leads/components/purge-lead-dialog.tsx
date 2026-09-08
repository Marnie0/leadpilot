import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { confirmationMatches } from '@leadpilot/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n';
import { useRichT } from '@/lib/i18n/rich';

/**
 * The last gate before a lead stops existing.
 *
 * The customer's own name rather than a fixed word, because "DELETE" can be
 * typed without reading and a name cannot — you have to look at what you are
 * destroying to type it back. `confirmationMatches` is the shared rule, so the
 * button here unlocks on exactly the condition the API will accept: the server
 * checks it too, since a browser-side guard on something with no undo is
 * decoration.
 */
export function PurgeLeadDialog({
  open,
  name,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const rich = useRichT();
  const [typed, setTyped] = useState('');

  // Each prompt starts empty, so a name typed for one lead can never carry into
  // the next one somebody opens.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const matches = confirmationMatches(typed, name);
  const showMismatch = typed.trim().length > 0 && !matches;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="auto">{t('lead.deleteForeverTitle', { name })}</DialogTitle>
          <DialogDescription>{t('lead.deleteForeverBody')}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{t('lead.deleteForeverWarning')}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="purge-confirm">
            {/* The name is interpolated as a node so it can be emphasised
                without splitting the sentence — Arabic puts it elsewhere. */}
            {rich('lead.deleteForeverConfirmLabel', {
              name: (
                <strong className="font-semibold text-foreground" dir="auto">
                  {name}
                </strong>
              ),
            })}
          </Label>
          <Input
            id="purge-confirm"
            value={typed}
            dir="auto"
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            aria-invalid={showMismatch}
          />
          {showMismatch && (
            <p className="text-xs text-destructive">{t('lead.deleteForeverMismatch')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" disabled={!matches || isPending} onClick={onConfirm}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t('lead.deleteForever')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
