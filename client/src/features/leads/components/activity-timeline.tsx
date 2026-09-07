import type { ActivityDto, ActivityType } from '@leadpilot/shared';
import {
  ArrowRightLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  Mail,
  MessageCircle,
  PencilLine,
  Phone,
  Sparkles,
  StickyNote,
  UserRoundCheck,
  Users2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { formatDateTime, formatRelative, initials } from '@/lib/format';
import { FIELD_LABELS, STAGE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users2,
  WHATSAPP: MessageCircle,
  LEAD_CREATED: Sparkles,
  STAGE_CHANGED: ArrowRightLeft,
  ASSIGNED: UserRoundCheck,
  FIELD_UPDATED: PencilLine,
  FOLLOW_UP_SCHEDULED: CalendarClock,
  FOLLOW_UP_COMPLETED: CalendarCheck2,
  FOLLOW_UP_CANCELLED: CalendarX2,
};

const USER_AUTHORED = new Set<ActivityType>(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP']);

const stageName = (key: string | undefined): string =>
  key ? (STAGE_LABELS[key as keyof typeof STAGE_LABELS] ?? key) : 'unknown';

/**
 * Builds the sentence for a system-generated entry from its structured
 * metadata.
 *
 * The server stores the *facts* (`fromStage`, `toStage`) rather than a rendered
 * English string, so Phase 3 can produce the Arabic sentence from the same row
 * without a migration or a backfill.
 */
function describeSystemActivity(activity: ActivityDto): React.ReactNode {
  const meta = activity.metadata ?? {};
  const actor = activity.author?.name ?? 'Someone';

  switch (activity.type) {
    case 'LEAD_CREATED':
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> created this lead
        </>
      );
    case 'STAGE_CHANGED':
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> moved the lead from{' '}
          <strong className="font-medium text-foreground">{stageName(meta.fromStage)}</strong> to{' '}
          <strong className="font-medium text-foreground">{stageName(meta.toStage)}</strong>
        </>
      );
    case 'ASSIGNED':
      return meta.toAssignee ? (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> assigned this lead to{' '}
          <strong className="font-medium text-foreground">{meta.toAssignee}</strong>
        </>
      ) : (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> removed the assigned rep
        </>
      );
    case 'FIELD_UPDATED': {
      const label = meta.field ? (FIELD_LABELS[meta.field] ?? meta.field) : 'a field';
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> updated the {label}
          {meta.to ? (
            <>
              {' '}
              to <strong className="font-medium text-foreground">{meta.to}</strong>
            </>
          ) : null}
        </>
      );
    }
    case 'FOLLOW_UP_SCHEDULED':
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> scheduled{' '}
          <strong className="font-medium text-foreground">{meta.followUpTitle}</strong>
          {meta.dueAt ? ` for ${formatDateTime(meta.dueAt)}` : null}
        </>
      );
    case 'FOLLOW_UP_COMPLETED':
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> completed{' '}
          <strong className="font-medium text-foreground">{meta.followUpTitle}</strong>
        </>
      );
    case 'FOLLOW_UP_CANCELLED':
      return (
        <>
          <strong className="font-medium text-foreground">{actor}</strong> cancelled{' '}
          <strong className="font-medium text-foreground">{meta.followUpTitle}</strong>
        </>
      );
    default:
      return actor;
  }
}

const TYPE_VERB: Partial<Record<ActivityType, string>> = {
  CALL: 'logged a call',
  EMAIL: 'logged an email',
  MEETING: 'logged a meeting',
  WHATSAPP: 'logged a WhatsApp message',
  NOTE: 'added a note',
};

function ActivityRow({ activity, isLast }: { activity: ActivityDto; isLast: boolean }) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? StickyNote;
  const isAuthored = USER_AUTHORED.has(activity.type);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* Connector line, hidden on the final entry so the timeline ends cleanly. */}
      {!isLast && (
        <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />
      )}

      <span
        className={cn(
          'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border',
          isAuthored
            ? 'border-primary/20 bg-primary/10 text-primary'
            : 'border-border bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm text-muted-foreground">
            {isAuthored ? (
              <>
                <strong className="font-medium text-foreground">
                  {activity.author?.name ?? 'A teammate'}
                </strong>{' '}
                {TYPE_VERB[activity.type] ?? 'added an entry'}
              </>
            ) : (
              describeSystemActivity(activity)
            )}
          </p>
          <time
            dateTime={activity.occurredAt}
            title={formatDateTime(activity.occurredAt)}
            className="text-xs whitespace-nowrap text-muted-foreground/80"
          >
            {formatRelative(activity.occurredAt)}
          </time>
        </div>

        {activity.body && (
          <div className="rounded-lg border bg-card px-3 py-2.5">
            <p className="text-sm whitespace-pre-wrap text-foreground">{activity.body}</p>
          </div>
        )}
      </div>
    </li>
  );
}

export function ActivityTimeline({
  activities,
  isLoading,
  error,
  onRetry,
}: {
  activities: ActivityDto[];
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  // A failed timeline must not look like a lead with no history — those are very
  // different facts, and only one of them is the user's problem to act on.
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} title="Could not load the activity" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Nothing logged yet"
        description="Add the first note or log a call — everything the team does with this lead shows up here."
      />
    );
  }

  return (
    <ol className="relative">
      {activities.map((activity, index) => (
        <ActivityRow
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1}
        />
      ))}
    </ol>
  );
}

/** Small author chip reused by the composer's preview row. */
export function AuthorChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback
          style={{ backgroundColor: color }}
          className="text-[10px] font-semibold text-white"
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">{name}</span>
    </span>
  );
}
