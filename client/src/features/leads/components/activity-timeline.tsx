import type { ActivityDto, ActivityType, StageKey } from '@leadpilot/shared';
import { STAGE_KEYS } from '@leadpilot/shared';
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
import { initials } from '@/lib/format';
import { leadFieldLabel } from '@/lib/labels';
import { useFormat, useI18n, type Formatters, type Translator } from '@/lib/i18n';
import { useRichT } from '@/lib/i18n/rich';
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

/**
 * The sentence used for an entry the user wrote, keyed by its type.
 *
 * Every one of these takes exactly `{actor}` and nothing else, which is what
 * lets the switch below hand the whole set to `rich` with one argument shape.
 */
type ActorSentenceKey =
  | 'activity.loggedCall'
  | 'activity.loggedEmail'
  | 'activity.loggedMeeting'
  | 'activity.loggedWhatsapp'
  | 'activity.addedNote'
  | 'activity.addedEntry';

const AUTHORED_SENTENCE: Partial<Record<ActivityType, ActorSentenceKey>> = {
  CALL: 'activity.loggedCall',
  EMAIL: 'activity.loggedEmail',
  MEETING: 'activity.loggedMeeting',
  WHATSAPP: 'activity.loggedWhatsapp',
  NOTE: 'activity.addedNote',
};

/** Emphasis for a name or value dropped into an activity sentence. */
function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

function ActivityRow({
  activity,
  isLast,
  t,
  rich,
  format,
}: {
  activity: ActivityDto;
  isLast: boolean;
  t: Translator;
  rich: ReturnType<typeof useRichT>;
  format: Formatters;
}) {
  const Icon = ACTIVITY_ICONS[activity.type] ?? StickyNote;
  const isAuthored = USER_AUTHORED.has(activity.type);
  const meta = activity.metadata ?? {};

  /** A stage key from activity metadata, rendered in the active language. */
  const stageLabel = (key: string | undefined) => {
    const known = STAGE_KEYS.find((candidate) => candidate === key);
    return known ? t(`stage.${known as StageKey}`) : t('activity.unknownStage');
  };

  /**
   * Builds the sentence from the entry's structured metadata.
   *
   * The server stores the *facts* (`fromStage`, `toStage`) rather than a
   * rendered English string, which is what makes this possible at all: the same
   * row from a year ago renders in Arabic with no migration and no backfill.
   */
  const sentence = (): React.ReactNode => {
    const actor = <Strong>{activity.author?.name ?? t('activity.someone')}</Strong>;

    if (isAuthored) {
      const key = AUTHORED_SENTENCE[activity.type] ?? 'activity.addedEntry';
      return rich(key, {
        actor: <Strong>{activity.author?.name ?? t('activity.teammate')}</Strong>,
      });
    }

    switch (activity.type) {
      case 'LEAD_CREATED':
        return rich('activity.created', { actor });

      case 'STAGE_CHANGED':
        return rich('activity.stageChanged', {
          actor,
          from: <Strong>{stageLabel(meta.fromStage)}</Strong>,
          to: <Strong>{stageLabel(meta.toStage)}</Strong>,
        });

      case 'ASSIGNED':
        return meta.toAssignee
          ? rich('activity.assigned', { actor, assignee: <Strong>{meta.toAssignee}</Strong> })
          : rich('activity.unassigned', { actor });

      case 'FIELD_UPDATED': {
        const field = leadFieldLabel(t, meta.field);
        if (!meta.to) return rich('activity.fieldUpdated', { actor, field });

        /*
         * A money figure is shown in the currency it was *entered* in, taken
         * from the entry itself, and deliberately not converted into the
         * reader's display currency. This is a record of what somebody typed;
         * restating it would make the history disagree with itself the moment
         * two people read it in different currencies. Entries written before
         * the currency was stamped have none, and render as the bare number
         * they always did.
         */
        const money =
          meta.field === 'estimatedValue' && meta.currency && Number.isFinite(Number(meta.to))
            ? format.currency(Number(meta.to), meta.currency, { precise: true })
            : meta.to;

        return rich('activity.fieldUpdatedTo', { actor, field, value: <Strong>{money}</Strong> });
      }

      case 'FOLLOW_UP_SCHEDULED': {
        const title = <Strong>{meta.followUpTitle}</Strong>;
        return meta.dueAt
          ? rich('activity.followUpScheduledFor', {
              actor,
              title,
              date: format.dateTime(meta.dueAt),
            })
          : rich('activity.followUpScheduled', { actor, title });
      }

      case 'FOLLOW_UP_COMPLETED':
        return rich('activity.followUpCompleted', {
          actor,
          title: <Strong>{meta.followUpTitle}</Strong>,
        });

      case 'FOLLOW_UP_CANCELLED':
        return rich('activity.followUpCancelled', {
          actor,
          title: <Strong>{meta.followUpTitle}</Strong>,
        });

      default:
        return actor;
    }
  };

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/*
        Connector line, hidden on the final entry so the timeline ends cleanly.
        It is pinned to the inline start so it stays under the icon column when
        the whole timeline mirrors.
      */}
      {!isLast && (
        <span className="absolute start-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
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
          <p className="text-sm text-muted-foreground">{sentence()}</p>
          <time
            dateTime={activity.occurredAt}
            title={format.dateTime(activity.occurredAt)}
            className="text-xs whitespace-nowrap text-muted-foreground/80"
          >
            {format.relative(activity.occurredAt)}
          </time>
        </div>

        {activity.body && (
          <div className="rounded-lg border bg-card px-3 py-2.5">
            {/*
              Direction is taken from the text itself, not from the interface.
              A note written in English inside an Arabic page would otherwise
              have its trailing full stop dragged to the wrong end of the line —
              the classic bidi artefact. `dir="auto"` reads the first strong
              character and lays the paragraph out accordingly, so each entry
              reads the way its author wrote it.
            */}
            <p className="text-sm whitespace-pre-wrap text-foreground" dir="auto">
              {activity.body}
            </p>
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
  const { t } = useI18n();
  const rich = useRichT();
  const format = useFormat();

  // A failed timeline must not look like a lead with no history — those are very
  // different facts, and only one of them is the user's problem to act on.
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} title={t('activity.couldNotLoad')} />;
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
        title={t('activity.emptyTitle')}
        description={t('activity.emptyBody')}
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
          t={t}
          rich={rich}
          format={format}
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
