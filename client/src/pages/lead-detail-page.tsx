import { useState } from 'react';
import { TRASH_RETENTION_DAYS } from '@leadpilot/shared';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  CalendarPlus,
  Mail,
  Loader2,
  MoreHorizontal,
  Pencil,
  Phone,
  Tag,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api-client';
import { telHref } from '@/lib/format';
import { useFormat, useT } from '@/lib/i18n';
import { useMoney } from '@/lib/money';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import {
  ACTIVITY_PAGE_SIZE,
  useArchiveLead,
  usePurgeLead,
  useRestoreLead,
  useRestoreLeadFromTrash,
  useTrashLead,
  useLead,
  useLeadActivities,
  useLeadFollowUps,
  useStages,
  useTeamMembers,
} from '@/features/leads/api';
import { StageBadge } from '@/features/leads/components/stage-badge';
import { PriorityBadge } from '@/features/leads/components/priority-badge';
import { ActivityTimeline } from '@/features/leads/components/activity-timeline';
import { NoteComposer } from '@/features/leads/components/note-composer';
import { FollowUpPanel } from '@/features/leads/components/follow-up-panel';
import { LeadStageSelect } from '@/features/leads/components/lead-stage-select';
import { LeadAssigneeSelect } from '@/features/leads/components/lead-assignee-select';
import { LeadFormDialog } from '@/features/leads/components/lead-form-dialog';
import { PurgeLeadDialog } from '@/features/leads/components/purge-lead-dialog';
import { FollowUpCell } from '@/features/leads/components/follow-up-cell';

/** Label + value row used throughout the details card. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * The only screen whose placeholder carries no words at all — a lead's name is
 * exactly what is not known yet. The back link is real rather than a skeleton,
 * so a slow load still leaves somewhere to go.
 */
function LeadDetailSkeleton() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link
        to="/leads"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="icon-directional size-4" aria-hidden />
        {t('lead.backToLeads')}
      </Link>
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    </div>
  );
}

export function LeadDetailPage() {
  const { leadId = '' } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const t = useT();
  const format = useFormat();
  const money = useMoney();
  const describeError = useApiErrorMessage();

  const [isEditOpen, setEditOpen] = useState(false);
  const [isArchiveOpen, setArchiveOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isPurgeOpen, setPurgeOpen] = useState(false);
  /**
   * Drives the activity query rather than filtering the fetched list client-side.
   * A client-side `body !== null` filter also matched FOLLOW_UP_COMPLETED entries
   * (they carry the outcome note), so the Notes tab showed system rows.
   */
  const [activityView, setActivityView] = useState<'all' | 'notes'>('all');
  /** Raised by "Show older activity"; the timeline used to stop dead at 50. */
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE_SIZE);

  const leadQuery = useLead(leadId, { enabled: leadId.length > 0 });
  const activitiesQuery = useLeadActivities(leadId, activityView, activityLimit);
  const followUpsQuery = useLeadFollowUps(leadId);
  const stagesQuery = useStages();
  const teamQuery = useTeamMembers();
  const archiveLead = useArchiveLead();
  const restoreLead = useRestoreLead();
  const trashLead = useTrashLead();
  const restoreFromTrash = useRestoreLeadFromTrash();
  const purgeLead = usePurgeLead();

  if (leadQuery.isLoading) return <LeadDetailSkeleton />;

  if (leadQuery.isError || !leadQuery.data) {
    const isMissing = leadQuery.error instanceof ApiError && leadQuery.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <Card>
          <ErrorState
            error={leadQuery.error}
            title={isMissing ? t('lead.missing') : t('lead.couldNotLoad')}
            onRetry={isMissing ? undefined : () => void leadQuery.refetch()}
          />
          <div className="flex justify-center pb-8">
            <Button variant="outline" asChild>
              <Link to="/leads">
                <ArrowLeft className="icon-directional size-4" /> {t('lead.backToLeads')}
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const lead = leadQuery.data;
  const activities = activitiesQuery.data?.data ?? [];
  const activityTotal = activitiesQuery.data?.meta.total ?? 0;
  const followUps = followUpsQuery.data?.data ?? [];

  /** Owners and admins only — the API enforces it, this just hides the affordance. */
  const canArchive = user.role === 'OWNER' || user.role === 'ADMIN';
  /** Archived and trashed leads reject every write, so they show no write UI. */
  const isEditable = !lead.archivedAt && !lead.deletedAt;

  const handleArchive = () => {
    archiveLead.mutate(lead.id, {
      onSuccess: () => {
        toast.success(t('lead.archived'), {
          description: t('lead.archivedDescription', { name: lead.customerName }),
        });
        navigate('/leads', { replace: true });
      },
      onError: (error: unknown) => {
        setArchiveOpen(false);
        toast.error(t('lead.couldNotArchive'), { description: describeError(error) });
      },
    });
  };

  const handleDelete = () => {
    trashLead.mutate(lead.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success(t('lead.deleted'), {
          description: t('lead.deletedDescription', { name: lead.customerName }),
        });
        navigate('/leads', { replace: true });
      },
      onError: (error: unknown) => {
        setDeleteOpen(false);
        toast.error(t('lead.couldNotDelete'), { description: describeError(error) });
      },
    });
  };

  const handleRestoreFromTrash = () => {
    restoreFromTrash.mutate(lead.id, {
      onSuccess: () => toast.success(t('lead.restoredFromTrash')),
      onError: (error: unknown) =>
        toast.error(t('lead.couldNotRestoreFromTrash'), { description: describeError(error) }),
    });
  };

  const handlePurge = (confirmName: string) => {
    purgeLead.mutate(
      { leadId: lead.id, confirmName },
      {
        onSuccess: () => {
          setPurgeOpen(false);
          toast.success(t('lead.deletedForever'));
          navigate('/leads?view=trash', { replace: true });
        },
        onError: (error: unknown) =>
          toast.error(t('lead.couldNotDeleteForever'), { description: describeError(error) }),
      },
    );
  };

  const handleRestore = () => {
    restoreLead.mutate(lead.id, {
      onSuccess: () => toast.success(t('lead.restored')),
      onError: (error: unknown) =>
        toast.error(t('lead.couldNotRestore'), { description: describeError(error) }),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/*
        `-my-2 py-2` grows the hit area to ~36px without moving the text: as a
        standalone back control it does not get WCAG 2.5.8's inline-link
        exemption, and 20px is an awkward thumb target.
      */}
      <Link
        to="/leads"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="icon-directional size-4" /> {t('lead.allLeads')}
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {lead.customerName}
            <StageBadge stage={lead.stage} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {lead.company && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" aria-hidden />
                {lead.company}
              </span>
            )}
            <span>{lead.requestedService}</span>
          </span>
        }
        actions={
          <>
            <div className="hidden sm:block">
              <LeadStageSelect lead={lead} stages={stagesQuery.data ?? []} />
            </div>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              <span className="hidden sm:inline">{t('lead.edit')}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t('lead.moreActions')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> {t('lead.editDetails')}
                </DropdownMenuItem>
                {canArchive && !lead.deletedAt && (
                  <>
                    <DropdownMenuSeparator />
                    {/* Archiving is filing; deleting says it should not exist.
                        Two entries because they are two decisions. */}
                    <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                      <Archive className="size-4" /> {t('lead.archive')}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                      <Trash2 className="size-4" /> {t('lead.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Stage control moves below the header on narrow screens. */}
      <div className="sm:hidden">
        <LeadStageSelect lead={lead} stages={stagesQuery.data ?? []} />
      </div>

      {lead.deletedAt && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t('lead.trashedTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('lead.trashedBody', {
                  date: format.date(lead.deletedAt),
                  count: TRASH_RETENTION_DAYS,
                })}
              </p>
            </div>
            {canArchive && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleRestoreFromTrash}
                  disabled={restoreFromTrash.isPending}
                >
                  <ArchiveRestore className="icon-directional size-4" />{' '}
                  {t('lead.restoreFromTrash')}
                </Button>
                {/* Destroying the record, its history and its follow-ups is
                    the one action with no way back — the typed confirmation
                    behind it is what carries that, not a narrower role. */}
                <Button variant="destructive" onClick={() => setPurgeOpen(true)}>
                  <Trash2 className="size-4" /> {t('lead.deleteForever')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {lead.archivedAt && !lead.deletedAt && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t('lead.archivedTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('lead.archivedBody', { date: format.date(lead.archivedAt) })}
              </p>
            </div>
            {canArchive && (
              <Button variant="outline" onClick={handleRestore} disabled={restoreLead.isPending}>
                <ArchiveRestore className="size-4" /> {t('lead.restore')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {lead.stage.type === 'LOST' && lead.lostReason && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-xs font-medium tracking-wide text-destructive uppercase">
              {t('lead.reasonLost')}
            </p>
            <p className="mt-1 text-sm text-foreground" dir="auto">
              {lead.lostReason}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Activity column */}
        <div className="min-w-0 space-y-6">
          {/*
            A lead that is archived or in the trash takes no new writes — the
            API refuses them, and it always has for archived ones. Offering a
            composer and an "Add entry" button that can only fail was the older
            half of that; the read-only history below stays, because seeing what
            is on the record is the reason you opened the page.
          */}
          {isEditable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('lead.logUpdate')}</CardTitle>
              </CardHeader>
              <CardContent>
                <NoteComposer leadId={lead.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{t('lead.activity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activityView}
                onValueChange={(value) => {
                  setActivityView(value as 'all' | 'notes');
                  setActivityLimit(ACTIVITY_PAGE_SIZE);
                }}
              >
                <TabsList className="mb-5">
                  <TabsTrigger value="all">
                    {t('lead.activityAll')}
                    <Badge variant="secondary" className="ms-1.5 px-1.5 text-[10px]">
                      {format.number(lead.counts.activities)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="notes">{t('lead.activityNotes')}</TabsTrigger>
                </TabsList>

                <TabsContent value={activityView}>
                  <ActivityTimeline
                    activities={activities}
                    isLoading={activitiesQuery.isLoading}
                    error={activitiesQuery.error}
                    onRetry={() => void activitiesQuery.refetch()}
                  />

                  {activityTotal > activities.length && (
                    <div className="mt-2 flex flex-col items-center gap-2 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        {t('lead.activityShowing', {
                          shown: format.number(activities.length),
                          total: format.number(activityTotal),
                        })}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activitiesQuery.isFetching}
                        onClick={() => setActivityLimit((current) => current + ACTIVITY_PAGE_SIZE)}
                      >
                        {activitiesQuery.isFetching && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        {t('lead.activityShowOlder')}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Details column */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('lead.contact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.email ? (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate text-foreground" dir="ltr">
                    {lead.email}
                  </span>
                </a>
              ) : (
                <p className="flex items-center gap-2.5 px-2 py-2 text-sm text-muted-foreground">
                  <Mail className="size-4 shrink-0" aria-hidden /> {t('lead.noEmail')}
                </p>
              )}

              {lead.phone ? (
                <a
                  href={telHref(lead.phone)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate text-foreground" dir="ltr">
                    {lead.phone}
                  </span>
                </a>
              ) : (
                <p className="flex items-center gap-2.5 px-2 py-2 text-sm text-muted-foreground">
                  <Phone className="size-4 shrink-0" aria-hidden /> {t('lead.noPhone')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('lead.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t('lead.assignedRep')}</p>
                <LeadAssigneeSelect lead={lead} members={teamQuery.data ?? []} />
              </div>

              <Separator className="my-3" />

              <dl className="divide-y">
                <DetailRow label={t('lead.estimatedValue')}>
                  <span className="inline-flex flex-col items-end gap-0.5 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-muted-foreground" aria-hidden />
                      {money.format(lead.estimatedValue, lead.currency, { precise: true })}
                    </span>
                    {/* One figure, so the original is worth showing outright
                        rather than as a footnote about the whole screen. */}
                    {money.isConverted && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {t('currency.original', {
                          amount: format.currency(lead.estimatedValue, lead.currency, {
                            precise: true,
                          }),
                        })}
                      </span>
                    )}
                  </span>
                </DetailRow>
                <DetailRow label={t('lead.requestedService')}>{lead.requestedService}</DetailRow>
                <DetailRow label={t('lead.source')}>{t(`source.${lead.source}`)}</DetailRow>
                <DetailRow label={t('lead.priority')}>
                  <PriorityBadge priority={lead.priority} />
                </DetailRow>
                <DetailRow label={t('lead.nextFollowUp')}>
                  <FollowUpCell dueAt={lead.nextFollowUpAt} />
                </DetailRow>
                <DetailRow label={t('lead.lastContacted')}>
                  {lead.lastContactedAt ? format.dateTime(lead.lastContactedAt) : t('lead.notYet')}
                </DetailRow>
                <DetailRow label={t('lead.created')}>
                  {format.date(lead.createdAt)}
                  {lead.createdBy && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {t('lead.createdBy', { name: lead.createdBy.name })}
                    </span>
                  )}
                </DetailRow>
                {lead.wonAt && (
                  <DetailRow label={t('lead.wonOn')}>{format.date(lead.wonAt)}</DetailRow>
                )}
              </dl>

              {lead.tags.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag className="size-3.5 text-muted-foreground" aria-hidden />
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              {lead.description && (
                <>
                  <Separator className="my-3" />
                  {/* Author's own words — see the activity timeline for why. */}
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground" dir="auto">
                    {lead.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarPlus className="size-4 text-muted-foreground" aria-hidden />
                {t('followUp.title')}
              </CardTitle>
              {lead.counts.openFollowUps > 0 && (
                <Badge variant="secondary">
                  {t('followUp.openCount', { count: format.number(lead.counts.openFollowUps) })}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <FollowUpPanel
                leadId={lead.id}
                followUps={followUps}
                isLoading={followUpsQuery.isLoading}
                error={followUpsQuery.error}
                onRetry={() => void followUpsQuery.refetch()}
                canSchedule={isEditable}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <LeadFormDialog
        open={isEditOpen}
        onOpenChange={setEditOpen}
        stages={stagesQuery.data ?? []}
        members={teamQuery.data ?? []}
        defaultCurrency={user.organization.defaultCurrency}
        lead={lead}
      />

      <Dialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="auto">
              {t('lead.deleteTitle', { name: lead.customerName })}
            </DialogTitle>
            <DialogDescription>
              {t('lead.deleteBody', { count: TRASH_RETENTION_DAYS })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={trashLead.isPending}>
              {trashLead.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('lead.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PurgeLeadDialog
        open={isPurgeOpen}
        name={lead.customerName}
        isPending={purgeLead.isPending}
        onCancel={() => setPurgeOpen(false)}
        onConfirm={() => handlePurge(lead.customerName)}
      />

      <Dialog open={isArchiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('lead.archiveConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('lead.archiveConfirmBody', {
                name: lead.customerName,
                count: lead.counts.activities,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiveLead.isPending}>
              {t('lead.archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
