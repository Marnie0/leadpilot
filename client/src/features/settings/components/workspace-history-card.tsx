import { History } from 'lucide-react';
import type { WorkspaceEventDto } from '@leadpilot/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useWorkspaceEvents } from '@/features/settings/api';
import { useFormat, useT } from '@/lib/i18n';

/**
 * What has happened to this workspace, and who did it.
 *
 * Only currency conversions so far, which is the point: it exists because that
 * one action rewrites every stored amount and cannot be undone, and an
 * irreversible change with no record of who made it is something a team ends up
 * reconstructing from memory a month later. Shown to everyone, not just the
 * owner — the people whose figures changed are the ones who need to know.
 */
export function WorkspaceHistoryCard() {
  const t = useT();
  const format = useFormat();
  const eventsQuery = useWorkspaceEvents();
  const events = eventsQuery.data ?? [];

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="p-6 pb-4">
        <CardTitle>{t('settings.historyTitle')}</CardTitle>
        <CardDescription>{t('settings.historyBody')}</CardDescription>
      </CardHeader>

      {eventsQuery.isError ? (
        <ErrorState
          error={eventsQuery.error}
          onRetry={() => void eventsQuery.refetch()}
          title={t('settings.couldNotLoadHistory')}
        />
      ) : eventsQuery.isLoading ? (
        <CardContent className="space-y-3 pb-6">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          ))}
        </CardContent>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title={t('settings.historyEmpty')}
          description={t('settings.historyEmptyBody')}
          className="py-10"
        />
      ) : (
        <ul className="divide-y border-t">
          {events.map((event) => (
            <EventRow key={event.id} event={event} format={format} t={t} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EventRow({
  event,
  format,
  t,
}: {
  event: WorkspaceEventDto;
  format: ReturnType<typeof useFormat>;
  t: ReturnType<typeof useT>;
}) {
  const change = event.currencyChange;
  const membership = event.membership;

  /*
   * One sentence per event type.
   *
   * The raw type used to fall through as the fallback, which was fine while
   * CURRENCY_CHANGED was the only member of the enum and would have started
   * printing `MEMBER_INVITED` at people the moment it was not.
   */
  const describe = (): string => {
    if (change) {
      return t('settings.eventCurrencyChanged', { from: change.from, to: change.to });
    }
    const name = membership?.subject ?? t('team.someone');
    const role = membership?.role ? t(`role.${membership.role}` as 'role.MEMBER') : '';
    switch (event.type) {
      case 'OWNERSHIP_TRANSFERRED':
        return t('settings.eventOwnershipTransferred', { name });
      case 'MEMBER_INVITED':
        return t('settings.eventMemberInvited', { name, role });
      case 'INVITE_ACCEPTED':
        return t('settings.eventInviteAccepted', { name, role });
      case 'INVITE_REVOKED':
        return t('settings.eventInviteRevoked', { name });
      case 'MEMBER_ROLE_CHANGED':
        return t('settings.eventRoleChanged', { name, role });
      case 'MEMBER_REMOVED':
        return t('settings.eventMemberRemoved', { name });
      default:
        return t('settings.eventUnknown');
    }
  };

  return (
    <li className="flex flex-col gap-1 px-6 py-4">
      <p className="text-sm text-foreground" dir="auto">
        {describe()}
      </p>
      {change && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t('settings.eventCurrencyDetail', {
            count: change.leads,
            from: change.from,
            // Four decimals, matching the rate the confirmation dialog quoted,
            // so the record and the prompt agree.
            rate: change.rate.toFixed(4),
            to: change.to,
          })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {/* A removed member still has to be somebody rather than nobody. */}
        {event.actor?.name ?? t('settings.eventByRemovedMember')} ·{' '}
        {format.dateTime(event.createdAt)}
      </p>
    </li>
  );
}
