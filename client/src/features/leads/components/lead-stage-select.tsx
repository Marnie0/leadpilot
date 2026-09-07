import { useState } from 'react';
import type { LeadDetailDto, PipelineStageDto, StageKey } from '@leadpilot/shared';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { stageName } from '@/lib/labels';
import { useMoveLeadStage } from '../api';

/**
 * Stage switcher.
 *
 * Moving to a LOST stage opens a reason prompt first: "why did we lose this"
 * is the single most useful thing to capture at that moment, and nobody goes
 * back to add it later.
 */
export function LeadStageSelect({
  lead,
  stages,
}: {
  lead: LeadDetailDto;
  stages: PipelineStageDto[];
}) {
  const { t, locale } = useI18n();
  const describeError = useApiErrorMessage();
  const moveStage = useMoveLeadStage(lead.id);
  const [pendingLostStage, setPendingLostStage] = useState<StageKey | null>(null);
  const [lostReason, setLostReason] = useState('');

  const applyStage = (stageKey: StageKey, reason?: string) => {
    moveStage.mutate(
      { stageKey, ...(reason ? { lostReason: reason } : {}) },
      {
        onSuccess: (updated) => {
          toast.success(t('lead.movedTo', { stage: stageName(updated.stage, locale) }));
          setPendingLostStage(null);
          setLostReason('');
        },
        onError: (error) => {
          toast.error(t('lead.couldNotMove'), { description: describeError(error) });
        },
      },
    );
  };

  const handleChange = (value: string) => {
    const stageKey = value as StageKey;
    if (stageKey === lead.stage.key) return;

    const target = stages.find((stage) => stage.key === stageKey);
    if (target?.type === 'LOST') {
      setPendingLostStage(stageKey);
      setLostReason(lead.lostReason ?? '');
      return;
    }

    applyStage(stageKey);
  };

  return (
    <>
      <Select value={lead.stage.key} onValueChange={handleChange} disabled={moveStage.isPending}>
        <SelectTrigger className="w-[168px]" aria-label={t('lead.pipelineStage')}>
          {moveStage.isPending ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {t('lead.moving')}
            </span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent align="end">
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.key}>
              <span className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                  aria-hidden
                />
                {stageName(stage, locale)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog
        open={pendingLostStage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLostStage(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('lead.markLostTitle')}</DialogTitle>
            <DialogDescription>{t('lead.markLostBody')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="lost-reason">{t('lead.lostReasonLabel')}</Label>
            <Textarea
              id="lost-reason"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              rows={3}
              placeholder={t('lead.lostReasonPlaceholder')}
              maxLength={280}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLostStage(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={moveStage.isPending}
              onClick={() => {
                if (pendingLostStage) applyStage(pendingLostStage, lostReason.trim() || undefined);
              }}
            >
              {moveStage.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('lead.markAsLost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
