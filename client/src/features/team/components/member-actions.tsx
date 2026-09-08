import { MoreHorizontal, ShieldCheck, UserCheck, UserX } from 'lucide-react';
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
 * Role and activation controls for one team member.
 *
 * The server owns every rule here — an admin may not touch an owner, the last
 * owner may not be demoted, nobody may deactivate themselves — and it is the
 * only place they are enforced. This hides the one case that is *always* futile
 * (an admin looking at an owner) and lets the rest come back as a translated
 * error rather than restating the conditions here and eventually disagreeing
 * with them.
 */
export function MemberActions({
  member,
  viewerId,
  viewerRole,
}: {
  member: ManageableMember;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const updateMember = useUpdateTeamMember();

  const isSelf = member.id === viewerId;
  if (member.role === 'OWNER' && viewerRole !== 'OWNER') return null;

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
          {USER_ROLES.map((role) => (
            <DropdownMenuRadioItem key={role} value={role}>
              <ShieldCheck className="size-4" aria-hidden /> {t(`role.${role}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {/* Deactivating yourself is refused by the API; not offering it is
            kinder than letting someone find that out by trying. */}
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            {member.isActive ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setActive(false)}>
                <UserX className="size-4" aria-hidden /> {t('team.deactivate')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setActive(true)}>
                <UserCheck className="size-4" aria-hidden /> {t('team.reactivate')}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
