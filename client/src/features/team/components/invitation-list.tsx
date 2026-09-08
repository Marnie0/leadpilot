import { Loader2, MailPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { InvitationDto, InvitationState } from '@leadpilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { cn } from '@/lib/utils';
import { useInvitations, useRevokeInvitation } from '../api';

const STATE_STYLES: Record<InvitationState, string> = {
  PENDING: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  ACCEPTED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  REVOKED: 'bg-muted text-muted-foreground border-transparent',
  EXPIRED: 'bg-muted text-muted-foreground border-transparent',
};

/**
 * Outstanding and past invitations.
 *
 * The link is never here — only the hash is stored, so it cannot be. What this
 * shows is who was asked, as what, by whom, and what became of it, which is the
 * part that is useful after the fact.
 */
export function InvitationList({ canManage }: { canManage: boolean }) {
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const query = useInvitations(canManage);
  const revoke = useRevokeInvitation();

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('team.invitations')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('team.invitationsBody')}</p>
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (query.data ?? []).length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title={t('team.noInvitations')}
            description={t('team.noInvitationsBody')}
            className="py-8"
          />
        ) : (
          <ul className="space-y-2">
            {(query.data ?? []).map((invitation: InvitationDto) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground" dir="ltr">
                    {invitation.email ?? t('team.inviteAnyoneWithLink')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('team.inviteMeta', {
                      role: t(`role.${invitation.role}`),
                      by: invitation.invitedBy?.name ?? t('team.someone'),
                      date: format.date(invitation.createdAt),
                    })}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn('text-[10px]', STATE_STYLES[invitation.state])}
                >
                  {t(`inviteState.${invitation.state}`)}
                </Badge>

                {invitation.state === 'PENDING' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground"
                    aria-label={t('team.revokeInvite')}
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate(invitation.id, {
                        onSuccess: () => toast.success(t('team.inviteRevoked')),
                        onError: (error) =>
                          toast.error(t('team.couldNotRevoke'), {
                            description: describeError(error),
                          }),
                      })
                    }
                  >
                    {revoke.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
