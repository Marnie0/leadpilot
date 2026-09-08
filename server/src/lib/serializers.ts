import type { Prisma } from '@prisma/client';
import { canMutateFollowUp, canMutateLead, type Viewer } from './permissions.js';
import type {
  ActivityDto,
  ActivityMetadata,
  FollowUpDto,
  LeadDetailDto,
  LeadListItemDto,
  PipelineStageDto,
  TeamMemberSummaryDto,
} from '@leadpilot/shared';

/**
 * Prisma rows are never returned to the client directly. Serialising through
 * these functions is what guarantees a password hash or another tenant's id can
 * never ride along in a response, and it pins the wire format so the client's
 * DTO types stay honest.
 */

/** Prisma `Decimal` → a plain JSON number. Values here are well inside 2^53. */
function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

const iso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);

export const TEAM_MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarColor: true,
  isActive: true,
} satisfies Prisma.UserSelect;

export const STAGE_SELECT = {
  id: true,
  key: true,
  name: true,
  nameAr: true,
  color: true,
  order: true,
  type: true,
  winProbability: true,
} satisfies Prisma.PipelineStageSelect;

type TeamMemberRow = Prisma.UserGetPayload<{ select: typeof TEAM_MEMBER_SELECT }>;
type StageRow = Prisma.PipelineStageGetPayload<{ select: typeof STAGE_SELECT }>;

export function toTeamMemberDto(user: TeamMemberRow | null): TeamMemberSummaryDto | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    isActive: user.isActive,
  };
}

export function toStageDto(stage: StageRow): PipelineStageDto {
  return {
    id: stage.id,
    key: stage.key,
    name: stage.name,
    nameAr: stage.nameAr,
    color: stage.color,
    order: stage.order,
    type: stage.type,
    winProbability: stage.winProbability,
  };
}

export const LEAD_LIST_SELECT = {
  id: true,
  // Both owner columns are selected purely to compute `canEdit`; neither is
  // serialised, so the wire format still exposes only the assignee object.
  assignedToId: true,
  createdById: true,
  customerName: true,
  company: true,
  email: true,
  phone: true,
  source: true,
  requestedService: true,
  estimatedValue: true,
  currency: true,
  priority: true,
  tags: true,
  nextFollowUpAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  stage: { select: STAGE_SELECT },
  assignedTo: { select: TEAM_MEMBER_SELECT },
} satisfies Prisma.LeadSelect;

export const LEAD_DETAIL_SELECT = {
  ...LEAD_LIST_SELECT,
  description: true,
  lostReason: true,
  archivedAt: true,
  wonAt: true,
  lostAt: true,
  lastContactedAt: true,
  createdBy: { select: TEAM_MEMBER_SELECT },
} satisfies Prisma.LeadSelect;

type LeadListRow = Prisma.LeadGetPayload<{ select: typeof LEAD_LIST_SELECT }>;
type LeadDetailRow = Prisma.LeadGetPayload<{ select: typeof LEAD_DETAIL_SELECT }>;

/**
 * @param viewer used to compute `canEdit`. Required rather than optional: an
 * omitted viewer would have to default to something, and either default is
 * wrong somewhere — `true` over-promises in the UI, `false` disables actions a
 * manager is entitled to.
 */
export function toLeadListItemDto(lead: LeadListRow, viewer: Viewer): LeadListItemDto {
  return {
    id: lead.id,
    customerName: lead.customerName,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    requestedService: lead.requestedService,
    estimatedValue: decimalToNumber(lead.estimatedValue),
    currency: lead.currency,
    priority: lead.priority,
    stage: toStageDto(lead.stage),
    assignedTo: toTeamMemberDto(lead.assignedTo),
    tags: lead.tags,
    nextFollowUpAt: iso(lead.nextFollowUpAt),
    lastActivityAt: iso(lead.lastActivityAt),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    canEdit: canMutateLead(viewer, lead),
  };
}

export function toLeadDetailDto(
  lead: LeadDetailRow,
  counts: { activities: number; followUps: number; openFollowUps: number },
  viewer: Viewer,
): LeadDetailDto {
  return {
    ...toLeadListItemDto(lead, viewer),
    description: lead.description,
    archivedAt: iso(lead.archivedAt),
    lostReason: lead.lostReason,
    wonAt: iso(lead.wonAt),
    lostAt: iso(lead.lostAt),
    lastContactedAt: iso(lead.lastContactedAt),
    createdBy: toTeamMemberDto(lead.createdBy),
    counts,
  };
}

export const ACTIVITY_SELECT = {
  id: true,
  leadId: true,
  type: true,
  body: true,
  metadata: true,
  occurredAt: true,
  createdAt: true,
  userId: true,
  user: { select: TEAM_MEMBER_SELECT },
} satisfies Prisma.ActivitySelect;

type ActivityRow = Prisma.ActivityGetPayload<{ select: typeof ACTIVITY_SELECT }>;

/**
 * @param viewer used to decide `canEdit`: an author may edit their own note,
 * and an owner or admin may edit any note. System entries are never editable.
 */
export function toActivityDto(
  activity: ActivityRow,
  viewer: { userId: string; role: string },
): ActivityDto {
  const isUserAuthored = activity.userId !== null;
  const isManager = viewer.role === 'OWNER' || viewer.role === 'ADMIN';
  const isSystemEntry = !['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP'].includes(activity.type);

  return {
    id: activity.id,
    leadId: activity.leadId,
    type: activity.type,
    body: activity.body,
    metadata: (activity.metadata as ActivityMetadata | null) ?? null,
    occurredAt: activity.occurredAt.toISOString(),
    createdAt: activity.createdAt.toISOString(),
    author: toTeamMemberDto(activity.user),
    canEdit: !isSystemEntry && isUserAuthored && (activity.userId === viewer.userId || isManager),
  };
}

/**
 * Always carries the owning lead's assignment, because `canEdit` cannot be
 * decided without it — a rep may act on a follow-up for a lead of theirs even
 * when the task itself is somebody else's. Selecting it here rather than at
 * each call site is what stops one of them forgetting and quietly reporting
 * everything as editable.
 */
export const FOLLOW_UP_SELECT = {
  id: true,
  leadId: true,
  title: true,
  notes: true,
  dueAt: true,
  channel: true,
  status: true,
  completedAt: true,
  createdAt: true,
  assignedToId: true,
  createdById: true,
  assignedTo: { select: TEAM_MEMBER_SELECT },
  lead: { select: { assignedToId: true, createdById: true } },
} satisfies Prisma.FollowUpSelect;

/** Adds the fields a follow-up needs to name and link its lead. */
export const FOLLOW_UP_WITH_LEAD_SELECT = {
  ...FOLLOW_UP_SELECT,
  lead: {
    select: { id: true, customerName: true, company: true, assignedToId: true, createdById: true },
  },
} satisfies Prisma.FollowUpSelect;

type FollowUpRow = Prisma.FollowUpGetPayload<{ select: typeof FOLLOW_UP_SELECT }> & {
  lead: { id?: string; customerName?: string; company?: string | null } & {
    assignedToId: string | null;
    createdById: string | null;
  };
};

export function toFollowUpDto(followUp: FollowUpRow, viewer: Viewer): FollowUpDto {
  const { lead } = followUp;
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    title: followUp.title,
    notes: followUp.notes,
    dueAt: followUp.dueAt.toISOString(),
    channel: followUp.channel,
    status: followUp.status,
    completedAt: iso(followUp.completedAt),
    createdAt: followUp.createdAt.toISOString(),
    assignedTo: toTeamMemberDto(followUp.assignedTo),
    // `lead` is only echoed back when the caller asked for the display fields;
    // the assignment columns are an implementation detail of `canEdit` and have
    // no business crossing the wire.
    ...(lead.id !== undefined && {
      lead: { id: lead.id, customerName: lead.customerName!, company: lead.company ?? null },
    }),
    canEdit: canMutateFollowUp(viewer, followUp),
  };
}
