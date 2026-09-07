import { useState } from 'react';
import type { BulkLeadResultDto, PipelineStageDto } from '@leadpilot/shared';
import { Archive, ArchiveRestore, ChevronDown, Loader2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stageName } from '@/lib/labels';
import { useFormat, useI18n } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import {
  useBulkArchive,
  useBulkAssign,
  useBulkMoveStage,
  useBulkRestore,
  type TeamMemberDetail,
} from '../api';

/**
 * Actions for the current selection.
 *
 * It floats over the page rather than sitting in the toolbar, for two reasons:
 * it must not push the table down and reflow the rows you are in the middle of
 * ticking, and on a phone the bottom of the screen is where a thumb already is.
 *
 * Which actions appear depends on what the selection is *for*: archiving is an
 * owner/admin act, and while the Archived filter is on, the useful inverse is
 * restore rather than archive again.
 */
export function BulkActionBar({
  ids,
  stages,
  members,
  canArchive,
  viewingArchived,
  onDone,
  onClear,
}: {
  ids: string[];
  stages: PipelineStageDto[];
  members: TeamMemberDetail[];
  canArchive: boolean;
  viewingArchived: boolean;
  onDone: () => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archive = useBulkArchive();
  const restore = useBulkRestore();
  const moveStage = useBulkMoveStage();
  const assign = useBulkAssign();

  const isPending =
    archive.isPending || restore.isPending || moveStage.isPending || assign.isPending;

  /**
   * Reports what the server actually did.
   *
   * A bulk action can partly apply, and the two reasons for that are different
   * answers: "these were not yours to change" is worth knowing about, "these
   * were already like that" is not really. Only the first is worth a line under
   * the toast — reporting both as one "skipped" count told an owner they could
   * only edit their own leads, which is not true of an owner.
   */
  const report = (result: BulkLeadResultDto) => {
    if (result.updated === 0) {
      toast.info(result.notPermitted > 0 ? t('bulk.noneAllowed') : t('bulk.nothingToDo'));
      return;
    }
    toast.success(t('bulk.updated', { count: result.updated }), {
      ...(result.notPermitted > 0 && {
        description: t('bulk.notPermitted', { count: format.number(result.notPermitted) }),
      }),
    });
  };

  const fail = (error: unknown) =>
    toast.error(t('bulk.failed'), { description: describeError(error) });

  /** Shared callbacks, so every action reports and clears the same way. */
  const handlers = {
    onSuccess: (result: BulkLeadResultDto) => {
      report(result);
      onDone();
    },
    onError: fail,
  };

  const activeMembers = members.filter((member) => member.isActive);
  const count = ids.length;

  return (
    <>
      {/*
        `pointer-events-none` on the positioning layer so the bar's own margins
        never swallow a click meant for the row underneath it.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div
          role="toolbar"
          aria-label={t('bulk.actions')}
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur"
        >
          <span className="px-2 text-sm font-medium whitespace-nowrap text-foreground tabular-nums">
            {t('bulk.selected', { count })}
          </span>

          {/*
            `data-[orientation=vertical]` rather than a bare `h-6`: the primitive
            sets `h-full` behind that same variant, which a plain height class
            does not override. Left alone it resolved against the wrapping flex
            row and stretched to 70px, which pushed the bar's second row off the
            bottom of a phone screen entirely.
          */}
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                {t('bulk.moveToStage')}
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-52">
              <DropdownMenuLabel className="text-xs">{t('bulk.moveToStage')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  onSelect={() => moveStage.mutate({ ids, stageKey: stage.key }, handlers)}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden
                  />
                  {stageName(stage, locale)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isPending}>
                {t('bulk.assignTo')}
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-56">
              <DropdownMenuLabel className="text-xs">{t('bulk.assignTo')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => assign.mutate({ ids, assignedToId: null }, handlers)}
              >
                <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                {t('common.unassigned')}
              </DropdownMenuItem>
              {activeMembers.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onSelect={() => assign.mutate({ ids, assignedToId: member.id }, handlers)}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: member.avatarColor }}
                    aria-hidden
                  />
                  {member.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {canArchive &&
            (viewingArchived ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => restore.mutate({ ids }, handlers)}
              >
                <ArchiveRestore className="size-3.5" aria-hidden />
                {t('bulk.restore')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isPending}
                onClick={() => setConfirmArchive(true)}
              >
                <Archive className="size-3.5" aria-hidden />
                {t('bulk.archive')}
              </Button>
            ))}

          <Separator orientation="vertical" className="data-[orientation=vertical]:h-6" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isPending}
            aria-label={t('bulk.clear')}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">{t('bulk.clear')}</span>
          </Button>
        </div>
      </div>

      {/* Archiving in bulk is the one action here that removes things from view,
          so it is the one that asks first. */}
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bulk.archiveTitle', { count })}</DialogTitle>
            <DialogDescription>{t('bulk.archiveBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmArchive(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={archive.isPending}
              onClick={() => {
                setConfirmArchive(false);
                archive.mutate({ ids }, handlers);
              }}
            >
              {archive.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('bulk.archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
