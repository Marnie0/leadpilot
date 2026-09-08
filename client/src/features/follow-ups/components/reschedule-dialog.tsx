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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n';

/**
 * `datetime-local` reads and writes wall-clock time with no zone, so both ends
 * of the conversion have to be explicit. `toLocalInput` shifts a UTC instant
 * into the browser's offset for display; `fromLocalInput` lets `new Date()`
 * read it back in that same offset. Skipping either step moves every
 * rescheduled task by the user's UTC offset, which is invisible in London and
 * loudly wrong in Dubai.
 */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Keeps the time of day and moves the date, which is what "tomorrow" means. */
function shiftDays(iso: string, days: number): string {
  const from = new Date(iso);
  const base = Number.isNaN(from.getTime()) ? new Date() : from;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  // A task already overdue should land tomorrow, not one day further into the
  // past, so anything behind us is measured from now instead.
  if (next.getTime() < Date.now()) {
    const fromNow = new Date();
    fromNow.setDate(fromNow.getDate() + days);
    fromNow.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return fromNow.toISOString();
  }
  return next.toISOString();
}

export function RescheduleDialog({
  open,
  title,
  dueAt,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  dueAt: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (dueAt: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(() => toLocalInput(dueAt));

  useEffect(() => {
    if (open) setValue(toLocalInput(dueAt));
  }, [open, dueAt]);

  const iso = fromLocalInput(value);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle dir="auto">{t('followUp.rescheduleTitle', { title })}</DialogTitle>
          <DialogDescription>{t('followUp.rescheduleBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* The two answers people actually give, without opening a picker. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue(toLocalInput(shiftDays(dueAt, 1)))}
            >
              {t('followUp.snoozeTomorrow')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue(toLocalInput(shiftDays(dueAt, 7)))}
            >
              {t('followUp.snoozeWeek')}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="follow-up-due">{t('followUp.due')}</Label>
            <Input
              id="follow-up-due"
              type="datetime-local"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button disabled={isPending || iso === null} onClick={() => iso && onConfirm(iso)}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t('followUp.reschedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
