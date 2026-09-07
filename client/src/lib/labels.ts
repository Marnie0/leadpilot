import type {
  ActivityType,
  FollowUpChannel,
  FollowUpStatus,
  LeadPriority,
  LeadSource,
  StageKey,
  UserRole,
} from '@leadpilot/shared';

/**
 * Display strings for every enum the API returns.
 *
 * Centralised here rather than inlined at each call site so Phase 3 can swap
 * this module for a translation lookup without touching a single component.
 */

export const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  SOCIAL_MEDIA: 'Social media',
  PAID_ADS: 'Paid ads',
  COLD_CALL: 'Cold call',
  EMAIL_CAMPAIGN: 'Email campaign',
  EVENT: 'Event',
  WALK_IN: 'Walk-in',
  PARTNER: 'Partner',
  MARKETPLACE: 'Marketplace',
  OTHER: 'Other',
};

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Tailwind classes per priority — muted for low, loud for urgent. */
export const PRIORITY_STYLES: Record<LeadPriority, string> = {
  LOW: 'bg-muted text-muted-foreground border-transparent',
  MEDIUM: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  HIGH: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  URGENT: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25',
};

export const STAGE_LABELS: Record<StageKey, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  WON: 'Won',
  LOST: 'Lost',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Sales rep',
};

export const CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  OTHER: 'Other',
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  NOTE: 'Note',
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  WHATSAPP: 'WhatsApp',
  LEAD_CREATED: 'Lead created',
  STAGE_CHANGED: 'Stage changed',
  ASSIGNED: 'Assignment',
  FIELD_UPDATED: 'Details updated',
  FOLLOW_UP_SCHEDULED: 'Follow-up scheduled',
  FOLLOW_UP_COMPLETED: 'Follow-up completed',
  FOLLOW_UP_CANCELLED: 'Follow-up cancelled',
};

/** Human labels for the fields named in a FIELD_UPDATED activity entry. */
export const FIELD_LABELS: Record<string, string> = {
  customerName: 'customer name',
  company: 'company',
  email: 'email',
  phone: 'phone',
  requestedService: 'requested service',
  estimatedValue: 'estimated value',
  priority: 'priority',
  source: 'lead source',
};

export const SORT_LABELS: Record<string, string> = {
  updatedAt: 'Last updated',
  createdAt: 'Date created',
  customerName: 'Customer name',
  company: 'Company',
  estimatedValue: 'Estimated value',
  nextFollowUpAt: 'Next follow-up',
  lastActivityAt: 'Last activity',
  stage: 'Pipeline stage',
  priority: 'Priority',
};

export const FOLLOW_UP_FILTER_LABELS: Record<string, string> = {
  any: 'Any follow-up',
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  none: 'No follow-up set',
};
