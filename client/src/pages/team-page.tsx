import { Users2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTeamMembers } from '@/features/leads/api';
import { formatRelative, initials } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

const ROLE_VARIANTS = {
  OWNER: 'default',
  ADMIN: 'secondary',
  MEMBER: 'outline',
} as const;

export function TeamPage() {
  const user = useCurrentUser();
  const teamQuery = useTeamMembers();
  const members = teamQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Team"
        description={`Everyone with access to ${user.organization.name}.`}
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
          <EmptyState icon={Users2} title="No team members yet" />
        ) : (
          <ul className="divide-y">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6"
              >
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
                      <span className="text-xs font-normal text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  {!member.isActive && <Badge variant="destructive">Deactivated</Badge>}
                  <Badge variant={ROLE_VARIANTS[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                </div>

                <p className="w-full text-xs text-muted-foreground sm:w-auto sm:min-w-[140px] sm:text-right">
                  {member.lastLoginAt ? `Active ${formatRelative(member.lastLoginAt)}` : 'Never signed in'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">
        Inviting new teammates and changing roles arrives with the admin settings in a later
        release.
      </p>
    </div>
  );
}
