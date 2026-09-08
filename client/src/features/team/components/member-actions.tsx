import { Crown, MoreHorizontal, ShieldCheck, UserCheck, UserMinus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { USER_ROLES, type UserRole } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useUpdateTeamMember } from '../api';

export interface ManageableMember {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Role and membership controls for one team member.
 *
 * The server owns every rule here and is the only place they are enforced. This
 * hides the options that are *always* futile — anyone looking at the owner,
 * an admin trying to grant admin, anybody acting on themselves — so nobody
 * discovers a permission by being refused. The rest is left to come back as a
 * translated error rather than restating conditions that would eventually
 * disagree with the server's.
 *
 * The rules, as the product defines them:
 *
 *  - **Owner** — exactly one, cannot be demoted or removed. Hands the role over
 *    with `transfer-ownership`, becoming an admin in the same transaction.
 *  - **Admin** — may change anyone's role and remove anyone, *except* that only
 *    the owner can make somebody an admin, and nobody can touch the owner.
 *  - **Member** — none of this.
 */
export function MemberActions({
  member,
  viewerId,
  viewerRole,
  onTransfer,
  onRemove,
}: {
  member: ManageableMember;
  viewerId: string;
  viewerRole: UserRole;
  /** Both open a confirmation the page owns — neither acts from this menu. */
  onTransfer: (member: ManageableMember) => void;
  onRemove: (member: ManageableMember) => void;
}) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const updateMember = useUpdateTeamMember();

  const isSelf = member.id === viewerId;
  const isOwner = member.role === 'OWNER';
  const viewerIsOwner = viewerRole === 'OWNER';

  /*
   * Nothing is offered on the owner's own row, to anybody.
   *
   * There is exactly one owner and the database enforces it, so every action
   * here has no valid destination for that row: demoting leaves the workspace
   * ownerless, removing does the same, and "transfer" is initiated from the
   * *recipient's* row rather than the owner's.
   */
  if (isOwner) return null;
  // Acting on yourself is refused server-side in every case that matters.
  if (isSelf) return null;

  const fail = (error: unknown) =>
    toast.error(t('team.couldNotUpdate'), { description: describeError(error) });

  const setRole = (role: UserRole) => {
    if (role === member.role) return;
    updateMember.mutate(
      { id: member.id, role },
      {
        onSuccess: () =>
          toast.success(t('team.roleChanged', { name: member.name, role: t(`role.${role}`) })),
        onError: fail,
      },
    );
  };

  const setActive = (isActive: boolean) => {
    updateMember.mutate(
      { id: member.id, isActive },
      {
        onSuccess: () =>
          toast.success(
            isActive
              ? t('team.reactivated', { name: member.name })
              : t('team.deactivated_action', { name: member.name }),
          ),
        onError: fail,
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          disabled={updateMember.isPending}
          aria-label={t('team.manage', { name: member.name })}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t('team.changeRole')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={member.role}
          onValueChange={(value) => setRole(value as UserRole)}
        >
          {USER_ROLES.filter((role) => {
            // Ownership is transferred, never picked from a list.
            if (role === 'OWNER') return false;
            // Only the owner grants admin. An admin seeing the row and being
            // refused would be the API teaching a permission by rejection.
            if (role === 'ADMIN') return viewerIsOwner;
            return true;
          }).map((role) => (
            <DropdownMenuRadioItem key={role} value={role}>
              <ShieldCheck className="size-4" aria-hidden /> {t(`role.${role}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {viewerIsOwner && member.isActive && (
          <DropdownMenuItem onSelect={() => onTransfer(member)}>
            <Crown className="size-4" aria-hidden /> {t('team.makeOwner')}
          </DropdownMenuItem>
        )}

        {member.isActive ? (
          <DropdownMenuItem variant="destructive" onSelect={() => setActive(false)}>
            <UserX className="size-4" aria-hidden /> {t('team.deactivate')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => setActive(true)}>
            <UserCheck className="size-4" aria-hidden /> {t('team.reactivate')}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member)}>
          <UserMinus className="size-4" aria-hidden /> {t('team.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
