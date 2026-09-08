import { Crown, MoreHorizontal, ShieldCheck, UserCheck, UserMinus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type { RoleDto, TeamMemberSummaryDto } from '@leadpilot/shared';
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
import { useI18n, useT } from '@/lib/i18n';
import { useCurrentUser } from '@/features/auth/auth-context';
import { roleLabel, useIsOwner } from '@/lib/permissions';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useUpdateTeamMember } from '../api';

export type ManageableMember = Pick<
  TeamMemberSummaryDto,
  'id' | 'name' | 'role' | 'isOwner' | 'isActive'
>;

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
  roles,
  onTransfer,
  onRemove,
}: {
  member: ManageableMember;
  viewerId: string;
  /** Every role in the workspace, so the menu can offer the real ones. */
  roles: RoleDto[];
  /** Both open a confirmation the page owns — neither acts from this menu. */
  onTransfer: (member: ManageableMember) => void;
  onRemove: (member: ManageableMember) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const describeError = useApiErrorMessage();
  const updateMember = useUpdateTeamMember();

  const isSelf = member.id === viewerId;
  const viewerIsOwner = useIsOwner();
  const viewerPermissions = useCurrentUser().role.permissions;

  /*
   * Nothing is offered on the owner's own row, to anybody.
   *
   * There is exactly one owner and the database enforces it, so every action
   * here has no valid destination for that row: demoting leaves the workspace
   * ownerless, removing does the same, and "transfer" is initiated from the
   * *recipient's* row rather than the owner's.
   */
  if (member.isOwner) return null;
  // Acting on yourself is refused server-side in every case that matters.
  if (isSelf) return null;

  const fail = (error: unknown) =>
    toast.error(t('team.couldNotUpdate'), { description: describeError(error) });

  const setRole = (roleId: string) => {
    if (roleId === member.role.id) return;
    const role = roles.find((entry) => entry.id === roleId);
    updateMember.mutate(
      { id: member.id, roleId },
      {
        onSuccess: () =>
          toast.success(
            t('team.roleChanged', {
              name: member.name,
              role: role ? roleLabel(role, locale) : '',
            }),
          ),
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
        <DropdownMenuRadioGroup value={member.role.id} onValueChange={setRole}>
          {roles
            .filter((role) => {
              // Ownership is transferred, never picked from a list.
              if (role.key === 'OWNER') return false;
              /*
               * Granting team management is the owner's alone — the same rule
               * the server enforces in `canGrantRole`. Offering the row to
               * somebody who would be refused teaches a permission by
               * rejection, which is what `canEdit` on a lead row exists to
               * avoid.
               */
              if (role.permissions.includes('MANAGE_TEAM')) return viewerIsOwner;
              // And nobody hands out what they do not hold themselves, which is
              // the other half of `canGrantRole`.
              return role.permissions.every((permission) => viewerPermissions.includes(permission));
            })
            .map((role) => (
              <DropdownMenuRadioItem key={role.id} value={role.id}>
                <ShieldCheck className="size-4" aria-hidden /> {roleLabel(role, locale)}
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
