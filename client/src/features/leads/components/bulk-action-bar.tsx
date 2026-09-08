import { useState } from 'react';
import {
  TRASH_RETENTION_DAYS,
  type BulkLeadResultDto,
  type LeadView,
  type PipelineStageDto,
  type StageKey,
} from '@leadpilot/shared';
import { Archive, ArchiveRestore, ChevronDown, Loader2, Trash2, UserRound, X } from 'lucide-react';
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
import { LostReasonDialog } from '@/features/board/components/lost-reason-dialog';
import { stageName } from '@/lib/labels';
import { useFormat, useI18n } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import {
  useBulkArchive,
  useBulkAssign,
  useBulkMoveStage,
  useBulkRestore,
  useBulkRestoreFromTrash,
  useBulkTrash,
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
  view,
  onDone,
  onClear,
}: {
  ids: string[];
  stages: PipelineStageDto[];
  members: TeamMemberDetail[];
  canArchive: boolean;
  view: LeadView;
  /** Called with the ids to keep selected — empty clears the selection. */
  onDone: (keepSelected: string[]) => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const isTrashView = view === 'trash';
  /** A move into a Lost stage, held until the reason prompt is answered. */
  const [pendingLoss, setPendingLoss] = useState<StageKey | null>(null);

  const archive = useBulkArchive();
  const restore = useBulkRestore();
  const trash = useBulkTrash();
  const restoreFromTrash = useBulkRestoreFromTrash();
  const moveStage = useBulkMoveStage();
  const assign = useBulkAssign();

  const isPending =
    archive.isPending ||
    restore.isPending ||
    trash.isPending ||
    restoreFromTrash.isPending ||
    moveStage.isPending ||
    assign.isPending;

  /**
   * Reports what the server actually did.
   *
   * A bulk action can partly apply, and the two reasons are different answers.
   * "These were not yours to change" is worth acting on, and those rows stay
   * selected so the user can see which they were. "These were already like
   * that" needs no action, but it does need saying: selecting ten and being
   * told seven were updated, with nothing about the other three, reads as a
   * failure rather than as three rows that were already correct.
   */
  const report = (result: BulkLeadResultDto) => {
    const refused = result.notPermitted.length;

    if (result.updated === 0) {
      toast.info(refused > 0 ? t('bulk.noneAllowed') : t('bulk.nothingToDo'));
      return;
    }

    const detail = refused
      ? t('bulk.notPermitted', { count: format.number(refused) })
      : result.unchanged
        ? t('bulk.alreadyDone', { count: format.number(result.unchanged) })
        : null;

    toast.success(t('bulk.updated', { count: result.updated }), {
      ...(detail && { description: detail }),
    });
  };

  const fail = (error: unknown) =>
    toast.error(t('bulk.failed'), { description: describeError(error) });

  /** Shared callbacks, so every action reports and settles the same way. */
  const handlers = {
    onSuccess: (result: BulkLeadResultDto) => {
      report(result);
      // Rows the server refused stay selected; everything else clears.
      onDone(result.notPermitted);
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

          {/* Moving or reassigning something in the trash is not an action the
              API will perform, so it is not one the bar should offer. */}
          {!isTrashView && (
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
                    onSelect={() => {
                      // Closing deals as lost asks why, exactly as the board and
                      // the detail view do. Doing it silently here would have
                      // made the fastest way to lose a hundred deals also the
                      // only one that records nothing about them.
                      if (stage.type === 'LOST') {
                        setPendingLoss(stage.key);
                        return;
                      }
                      moveStage.mutate({ ids, stageKey: stage.key }, handlers);
                    }}
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
          )}

          {!isTrashView && (
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
          )}

          {/*
            The trash offers the one action that makes sense there. Destroying
            leads stays a single-record affair: the confirmation is the
            customer's name, and there is no name to type for a selection.
          */}
          {canArchive &&
            (view === 'trash' ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => restoreFromTrash.mutate({ ids }, handlers)}
              >
                <ArchiveRestore className="icon-directional size-3.5" aria-hidden />
                {t('bulk.restore')}
              </Button>
            ) : (
              <>
                {view === 'archived' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => restore.mutate({ ids }, handlers)}
                  >
                    <ArchiveRestore className="icon-directional size-3.5" aria-hidden />
                    {t('bulk.unarchive')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmArchive(true)}
                  >
                    <Archive className="size-3.5" aria-hidden />
                    {t('bulk.archive')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isPending}
                  onClick={() => setConfirmTrash(true)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t('bulk.delete')}
                </Button>
              </>
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

      <LostReasonDialog
        open={pendingLoss !== null}
        title={t('bulk.markLostTitle', { count })}
        isPending={moveStage.isPending}
        onCancel={() => setPendingLoss(null)}
        onConfirm={(lostReason) => {
          if (pendingLoss) {
            moveStage.mutate(
              { ids, stageKey: pendingLoss, ...(lostReason ? { lostReason } : {}) },
              handlers,
            );
          }
          setPendingLoss(null);
        }}
      />

      {/* The two actions that remove things from view are the two that ask
          first. Neither destroys anything — a deleted lead sits in the trash —
          so a count is confirmation enough; typing a name is reserved for the
          permanent step, which is one record at a time. */}
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

      <Dialog open={confirmTrash} onOpenChange={setConfirmTrash}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bulk.deleteTitle', { count })}</DialogTitle>
            <DialogDescription>
              {t('bulk.deleteBody', { count: TRASH_RETENTION_DAYS })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTrash(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={trash.isPending}
              onClick={() => {
                setConfirmTrash(false);
                trash.mutate({ ids }, handlers);
              }}
            >
              {trash.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('bulk.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
