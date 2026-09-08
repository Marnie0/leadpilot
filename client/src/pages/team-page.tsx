import { useState } from 'react';
import { Loader2, UserPlus, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTeamMembers } from '@/features/leads/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MemberActions, type ManageableMember } from '@/features/team/components/member-actions';
import { InviteDialog } from '@/features/team/components/invite-dialog';
import { InvitationList } from '@/features/team/components/invitation-list';
import { RolesCard } from '@/features/team/components/roles-card';
import { useRemoveTeamMember, useRoles, useTransferOwnership } from '@/features/team/api';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { initials } from '@/lib/format';
import { useFormat, useI18n, useT } from '@/lib/i18n';
import { roleLabel, useCan, useIsOwner } from '@/lib/permissions';

/*
 * A workspace can name its own roles, so the badge cannot be keyed off a fixed
 * list any more: the owner reads as the strongest variant, the seeded roles keep
 * the shades people are used to, and anything the workspace invented gets the
 * neutral outline.
 */
function roleVariant(member: { isOwner: boolean; role: { key: string | null } }) {
  if (member.isOwner) return 'default' as const;
  if (member.role.key === 'ADMIN') return 'secondary' as const;
  return 'outline' as const;
}

export function TeamPage() {
  const t = useT();
  const format = useFormat();
  const { locale } = useI18n();
  const user = useCurrentUser();
  const teamQuery = useTeamMembers();
  const members = teamQuery.data ?? [];
  const isManager = useCan('MANAGE_TEAM');
  const isOwner = useIsOwner();
  const rolesQuery = useRoles();
  const roles = rolesQuery.data ?? [];
  const describeError = useApiErrorMessage();

  const [isInviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<ManageableMember | null>(null);
  const [transferring, setTransferring] = useState<ManageableMember | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const removeMember = useRemoveTeamMember();
  const transferOwnership = useTransferOwnership();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={t('team.title')}
        description={t('team.description', { organization: user.organization.name })}
        actions={
          isManager ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" /> {t('team.invitePeople')}
            </Button>
          ) : undefined
        }
      />

      <Card className="gap-0 p-0">
        {teamQuery.isError ? (
          <ErrorState error={teamQuery.error} onRetry={() => void teamQuery.refetch()} />
        ) : teamQuery.isLoading ? (
          <CardContent className="space-y-4 py-6">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </CardContent>
        ) : members.length === 0 ? (
          <EmptyState icon={Users2} title={t('team.empty')} />
        ) : (
          <ul className="divide-y" aria-label={t('team.title')}>
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback
                    style={{ backgroundColor: member.avatarColor }}
                    className="text-xs font-semibold text-white"
                  >
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-foreground">
                    {member.name}
                    {member.id === user.id && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {t('common.you')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  {!member.isActive && <Badge variant="destructive">{t('team.deactivated')}</Badge>}
                  <Badge variant={roleVariant(member)} dir="auto">
                    {member.isOwner ? t('role.OWNER') : roleLabel(member.role, locale)}
                  </Badge>
                </div>

                <p className="flex-1 text-xs text-muted-foreground sm:min-w-[140px] sm:flex-none sm:text-end">
                  {member.lastLoginAt
                    ? t('team.activeAgo', { when: format.relative(member.lastLoginAt) })
                    : t('team.neverSignedIn')}
                </p>

                {isManager && (
                  <MemberActions
                    member={member}
                    viewerId={user.id}
                    roles={roles}
                    onTransfer={(target) => {
                      setConfirmName('');
                      setTransferring(target);
                    }}
                    onRemove={(target) => setRemoving(target)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InvitationList canManage={isManager} />

      {/* Roles are the owner's alone — see the card's own note on why. */}
      {isOwner && <RolesCard />}

      <p className="text-sm text-muted-foreground">
        {isManager ? t('team.footnote') : t('team.footnoteMember')}
      </p>

      <InviteDialog open={isInviteOpen} onOpenChange={setInviteOpen} roles={roles} />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="auto">
              {t('team.removeTitle', { name: removing?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('team.removeBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={() => {
                if (!removing) return;
                removeMember.mutate(removing.id, {
                  onSuccess: () => {
                    toast.success(t('team.removed', { name: removing.name }));
                    setRemoving(null);
                  },
                  onError: (error) =>
                    toast.error(t('team.couldNotRemove'), { description: describeError(error) }),
                });
              }}
            >
              {removeMember.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('team.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Ownership transfer asks for the recipient's name to be typed, the same
        friction as a permanent delete — from the giver's side it cannot be
        undone, and only the new owner can hand it back.
      */}
      <Dialog open={transferring !== null} onOpenChange={(open) => !open && setTransferring(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="auto">
              {t('team.transferTitle', { name: transferring?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {t('team.transferBody', { name: transferring?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="transfer-confirm">
              {t('team.transferConfirmLabel', { name: transferring?.name ?? '' })}
            </Label>
            <Input
              id="transfer-confirm"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              dir="auto"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferring(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={transferOwnership.isPending || confirmName.trim().length === 0}
              onClick={() => {
                if (!transferring) return;
                transferOwnership.mutate(
                  { id: transferring.id, confirmName },
                  {
                    onSuccess: () => {
                      toast.success(t('team.transferred', { name: transferring.name }));
                      setTransferring(null);
                    },
                    onError: (error) =>
                      toast.error(t('team.couldNotTransfer'), {
                        description: describeError(error),
                      }),
                  },
                );
              }}
            >
              {transferOwnership.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('team.makeOwner')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
