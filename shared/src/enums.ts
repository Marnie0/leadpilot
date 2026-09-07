/**
 * Domain enums shared by the API and the web client.
 *
 * These string-literal unions are the single source of truth. The Prisma enums
 * in `server/prisma/schema.prisma` mirror them exactly, so a value that type-checks
 * here is always persistable.
 */

/** Ordered pipeline stage keys. Order here defines board column order. */
export const STAGE_KEYS = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

/** Whether a stage is still in play, or a terminal win/loss. */
export const STAGE_TYPES = ['OPEN', 'WON', 'LOST'] as const;
export type StageType = (typeof STAGE_TYPES)[number];

/** Where the lead came from. Drives source-attribution reporting in Phase 2. */
export const LEAD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'PAID_ADS',
  'COLD_CALL',
  'EMAIL_CAMPAIGN',
  'EVENT',
  'WALK_IN',
  'PARTNER',
  'MARKETPLACE',
  'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/**
 * Activity feed entry types.
 * `NOTE` … `WHATSAPP` are authored by a user; the rest are system-generated
 * audit entries written by the service layer.
 */
export const ACTIVITY_TYPES = [
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'WHATSAPP',
  'LEAD_CREATED',
  'STAGE_CHANGED',
  'ASSIGNED',
  'FIELD_UPDATED',
  'FOLLOW_UP_SCHEDULED',
  'FOLLOW_UP_COMPLETED',
  'FOLLOW_UP_CANCELLED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Activity types a user is allowed to create directly. */
export const USER_ACTIVITY_TYPES = [
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'WHATSAPP',
] as const;
export type UserActivityType = (typeof USER_ACTIVITY_TYPES)[number];

export const FOLLOW_UP_CHANNELS = [
  'CALL',
  'EMAIL',
  'MEETING',
  'WHATSAPP',
  'SMS',
  'OTHER',
] as const;
export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export const FOLLOW_UP_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/**
 * Org-level roles.
 * OWNER  — billing + org settings, cannot be removed by others
 * ADMIN  — full lead access, can invite and manage members
 * MEMBER — a sales rep: sees org leads, edits the ones they own
 */
export const USER_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles allowed to administer the organisation and its members. */
export const MANAGER_ROLES: readonly UserRole[] = ['OWNER', 'ADMIN'];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'QAR', 'KWD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
