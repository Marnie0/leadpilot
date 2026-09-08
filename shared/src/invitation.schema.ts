import { z } from 'zod';
import { USER_ROLES, type UserRole } from './enums.js';
import { emailSchema, passwordSchema } from './auth.schema.js';
import { idSchema, requiredTrimmed } from './common.js';
import { msg } from './message.js';

/**
 * Joining a workspace.
 *
 * ## Why a link rather than an account created for you
 *
 * An admin creating accounts directly means an admin choosing somebody's
 * password, which is the wrong shape: it makes the administrator briefly hold a
 * credential that is not theirs, and it produces accounts nobody has ever
 * signed into. An invitation instead hands over a one-time secret, and the
 * person on the other end sets their own password.
 *
 * ## What an invite is allowed to do
 *
 * It carries the role the invitee lands on, and issuing one is bounded by the
 * same rule as granting that role directly — an admin may invite a member but
 * not another admin. Without that, "only the owner grants admin" is a rule you
 * bypass by sending a link instead of clicking a menu.
 */

/** How long an unaccepted invitation stays usable. */
export const INVITE_LIFETIME_DAYS = 7;

/** The roles an invitation may grant. Owner is transferred, never invited. */
export const INVITABLE_ROLES = USER_ROLES.filter(
  (role): role is Exclude<UserRole, 'OWNER'> => role !== 'OWNER',
);

export const createInvitationSchema = z.object({
  /**
   * Optional. Binding the invite to an address is what makes a forwarded link
   * fail closed instead of quietly admitting whoever received it.
   */
  email: emailSchema.optional(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** What the invitee sends back when they accept. */
export const acceptInvitationSchema = z.object({
  name: requiredTrimmed('field.name', 80, 2),
  password: passwordSchema,
  /**
   * Required when the invitation is not bound to an address, and ignored when
   * it is — an invite addressed to somebody must not be redeemable under a
   * different email just because the recipient typed one.
   */
  email: emailSchema.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const acceptInvitationFormSchema = acceptInvitationSchema
  .extend({ confirmPassword: z.string().min(1, { message: msg('validation.passwordConfirm') }) })
  .refine((values) => values.password === values.confirmPassword, {
    message: msg('validation.passwordMismatch'),
    path: ['confirmPassword'],
  });
export type AcceptInvitationFormValues = z.input<typeof acceptInvitationFormSchema>;

export const INVITATION_STATES = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] as const;
export type InvitationState = (typeof INVITATION_STATES)[number];

export interface InvitationDto {
  id: string;
  /** Null for a link anybody may redeem. */
  email: string | null;
  role: Exclude<UserRole, 'OWNER'>;
  state: InvitationState;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: { id: string; name: string } | null;
  acceptedBy: { id: string; name: string } | null;
  /**
   * Whether the invitation email actually reached the provider.
   *
   * Reported per invitation rather than as a global "is email configured"
   * flag, because those are different questions: a deployment with a working
   * provider can still have one address refused — an unverified sending domain
   * does exactly that. This says what happened to *this* message, so the UI can
   * tell somebody to copy the link instead of claiming a delivery that failed.
   */
  emailed: boolean;
  /**
   * The shareable link — present **only** in the response that created it.
   *
   * The raw token is never stored, so it cannot be shown again later. That is
   * the point rather than an inconvenience: a link retrievable from a list is a
   * standing credential any admin can pick up at any time, and there would be
   * no way to tell a leak from a legitimate re-read. Losing one means revoking
   * it and issuing another, which is cheap and leaves a trail.
   */
  link?: string;
}

/** What the accept screen may know before anybody has signed in. */
export interface InvitationPreviewDto {
  workspaceName: string;
  role: Exclude<UserRole, 'OWNER'>;
  invitedByName: string | null;
  /** Present when the invite is bound, so the form can lock the field. */
  email: string | null;
  expiresAt: string;
}

/* ------------------------------------------------------------------ *
 * Ownership
 * ------------------------------------------------------------------ */

/**
 * Handing the workspace to somebody else.
 *
 * A transfer rather than a grant, because there is exactly one owner and the
 * database enforces it. The giver becomes an admin in the same transaction —
 * there is no moment with two owners, and no moment with none.
 *
 * `confirmName` is the same typed-confirmation friction as a permanent delete,
 * and for the same reason: from the giver's side this cannot be undone. Only
 * the new owner can hand it back.
 */
export const transferOwnershipSchema = z.object({
  confirmName: z
    .string()
    .min(1, { message: msg('validation.confirmName') })
    .max(120),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export const removeMemberSchema = z.object({ id: idSchema });
