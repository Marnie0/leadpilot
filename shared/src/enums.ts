/**
 * Domain enums shared by the API and the web client.
 *
 * These string-literal unions are the single source of truth. The Prisma enums
 * in `server/prisma/schema.prisma` mirror them exactly, so a value that type-checks
 * here is always persistable.
 */

/** Ordered pipeline stage keys. Order here defines board column order. */
export const STAGE_KEYS = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
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
export const USER_ACTIVITY_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP'] as const;
export type UserActivityType = (typeof USER_ACTIVITY_TYPES)[number];

export const FOLLOW_UP_CHANNELS = ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'SMS', 'OTHER'] as const;
export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export const FOLLOW_UP_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

/**
 * The three roles every workspace is seeded with.
 *
 * A *key*, not the whole story: roles are rows now, a workspace may add its own,
 * and any of these three may be renamed. The key exists so code can still find
 * "the member role of this workspace" in order to assign an invitee, whatever it
 * has since been called.
 */
export const ROLE_KEYS = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * What a role may be allowed to do.
 *
 * A short closed list of the things this product actually gates, rather than a
 * generic resource×verb matrix. Each one replaces a check that used to read
 * "is this an admin?".
 *
 * Three powers are deliberately missing — managing roles, transferring
 * ownership, deleting the workspace — because they belong to the owner and are
 * not delegable. A permission you could grant yourself is not a permission.
 */
export const PERMISSIONS = [
  'MANAGE_TEAM',
  'MANAGE_WORKSPACE',
  'CHANGE_CURRENCY',
  'EDIT_ALL_LEADS',
  'DELETE_LEADS',
  'MANAGE_AI',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** What each seeded role starts with — and what the migration backfilled. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  // Exactly the old admin: everything except restating the workspace currency,
  // which was owner-only before roles existed and stays that way by default.
  ADMIN: ['MANAGE_TEAM', 'MANAGE_WORKSPACE', 'EDIT_ALL_LEADS', 'DELETE_LEADS', 'MANAGE_AI'],
  MEMBER: [],
};

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'QAR', 'KWD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
