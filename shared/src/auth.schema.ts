import { z } from 'zod';
import { msg } from './message.js';
import { LOCALES, type Permission, type RoleKey } from './enums.js';
import { idSchema, requiredTrimmed } from './common.js';
import { displayCurrencySchema } from './currency.schema.js';

export const PASSWORD_MIN_LENGTH = 10;

/**
 * Deliberately modest rules: length does more for entropy than symbol classes,
 * and heavy composition rules push users toward predictable substitutions.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: msg('validation.passwordMin', { count: PASSWORD_MIN_LENGTH }),
  })
  .max(128, { message: msg('validation.passwordMax', { count: 128 }) })
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: msg('validation.passwordLetter'),
  })
  .refine((value) => /[0-9]/.test(value), {
    message: msg('validation.passwordNumber'),
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: msg('validation.emailRequired') })
  .max(254)
  .email({ message: msg('validation.email') });

export const signupSchema = z.object({
  name: requiredTrimmed('field.name', 80, 2),
  email: emailSchema,
  password: passwordSchema,
  organizationName: requiredTrimmed('field.companyName', 80, 2),
  /**
   * The language the sign-up form was read in.
   *
   * Optional, because it is a courtesy rather than a credential. Without it a
   * visitor who arrived with an Arabic browser gets an account recorded as
   * English, and the interface flips out from under them the moment the session
   * loads — having just been filled in, in Arabic.
   */
  locale: z.enum(LOCALES).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Client-side signup form: adds the confirmation field the API does not need.
 */
export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string().min(1, { message: msg('validation.passwordConfirm') }) })
  .refine((values) => values.password === values.confirmPassword, {
    message: msg('validation.passwordMismatch'),
    path: ['confirmPassword'],
  });
export type SignupFormValues = z.infer<typeof signupFormSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: msg('validation.passwordRequired') }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    name: requiredTrimmed('field.name', 80, 2).optional(),
    locale: z.enum(LOCALES).optional(),
    /**
     * What currency this person reads figures in. `null` restores "follow the
     * workspace", which is why it is nullish rather than merely optional —
     * `undefined` means "leave it alone" and `null` means "clear it".
     */
    displayCurrency: displayCurrencySchema.optional(),
  })
  .refine((values) => Object.keys(values).length > 0, { message: msg('validation.noChanges') });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: msg('validation.currentPasswordRequired') }),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The authenticated user as returned by `GET /api/auth/me`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /**
   * The role this account holds, as a row rather than a tier.
   *
   * Carries its own labels because a workspace may rename it, and its
   * permissions because the client gates its own UI on them — the same set the
   * server enforces, sent once with the session rather than fetched per screen.
   */
  role: {
    id: string;
    key: RoleKey | null;
    name: string;
    nameAr: string;
    permissions: Permission[];
  };
  /** Owning the workspace is not a permission. See `role.schema.ts`. */
  isOwner: boolean;
  locale: 'en' | 'ar';
  /** Display-only currency override. `null` means the workspace's own. */
  displayCurrency: string | null;
  avatarColor: string;
  /**
   * Whether this address has been confirmed.
   *
   * Purely informational — nothing in the product is gated on it. The client
   * uses it for one banner offering to resend, because an unconfirmed address
   * is a recoverability problem for the user rather than a permission problem.
   */
  emailVerified: boolean;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    defaultCurrency: string;
    /**
     * Every currency this workspace actually holds leads in.
     *
     * On the session because it decides whether a whole control exists: the
     * "converted or broken down" switch is meaningless on the great majority
     * of workspaces, which trade in one currency, and a menu row that visibly
     * does nothing is worse than no row. One indexed group-by per session load.
     */
    currencies: string[];
    /** True for a throwaway demo sandbox, so the UI can say so. */
    isDemo: boolean;
    /** When the sandbox is reaped. Null for real workspaces. */
    expiresAt: string | null;
  };
}

export const teamMemberIdSchema = z.object({ id: idSchema });

/* ------------------------------------------------------------------ *
 * Email verification and password reset
 *
 * Every endpoint below answers identically whether or not the address it was
 * given has an account. That is the whole point: an API that says "no such
 * user" is a free membership oracle, and the only place the difference can
 * safely appear is the recipient's own inbox.
 * ------------------------------------------------------------------ */

/** How long a verification or reset link stays usable. */
export const AUTH_LINK_LIFETIME_HOURS = 24;

export const verifyEmailSchema = z.object({
  token: z.string().min(16).max(200),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  /** The language to write the email in. A courtesy, not a credential. */
  locale: z.enum(LOCALES).optional(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string().min(1, { message: msg('validation.passwordConfirm') }) })
  .refine((values) => values.password === values.confirmPassword, {
    message: msg('validation.passwordMismatch'),
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.input<typeof resetPasswordFormSchema>;

/**
 * The response to signing up, asking for a reset, or resending a verification.
 *
 * Deliberately carries nothing but an acknowledgement. No id, no session, no
 * hint about whether anything was created — see the note above.
 */
export interface AuthAcknowledgementDto {
  /** Always true. Present so the body is not an empty object. */
  ok: true;
  /**
   * Whether the deployment can actually send mail.
   *
   * Not a leak — it is a property of the server, identical for every caller —
   * and the sign-up screen needs it to avoid telling somebody to check an inbox
   * that will never receive anything.
   */
  emailConfigured: boolean;
}

/* ------------------------------------------------------------------ *
 * Deleting your own account
 * ------------------------------------------------------------------ */

/**
 * What happens to the work of somebody who leaves.
 *
 * The account row goes; the workspace's record of what happened does not. Leads
 * they were assigned become unassigned, leads and notes they authored keep
 * their text and lose their author — the schema already sets those references
 * to null rather than cascading, precisely so a person leaving does not delete
 * the history of the deals they worked.
 *
 * That is the honest trade. Erasing the notes would take a colleague's context
 * with them; keeping the name on a deleted account would be a record of
 * somebody who asked to be removed.
 */
export const deleteAccountSchema = z.object({
  /** The account's own password. Proof it is really them, not a live session. */
  password: z.string().min(1, { message: msg('validation.passwordRequired') }),
  /** Typed confirmation, matched against the account's email address. */
  confirmEmail: z
    .string()
    .min(1, { message: msg('validation.confirmEmail') })
    .max(160),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * Deleting the whole workspace. Owner only, and it takes everything with it.
 */
export const deleteWorkspaceSchema = z.object({
  password: z.string().min(1, { message: msg('validation.passwordRequired') }),
  /** Matched against the workspace's name. */
  confirmName: z
    .string()
    .min(1, { message: msg('validation.confirmName') })
    .max(160),
});
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;

/**
 * Why an account cannot be deleted yet, if it cannot.
 *
 * The owner is blocked until they hand the workspace over or delete it — a
 * workspace with no owner is not a state the product has, and the database
 * would refuse it anyway. Sent ahead of the attempt so the screen can explain
 * the two ways out instead of presenting a button that only fails.
 */
export interface AccountDeletionStatusDto {
  canDelete: boolean;
  /** `OWNER_MUST_TRANSFER` when they own a workspace with other people in it. */
  reason: 'OWNER_MUST_TRANSFER' | null;
  /** How many other active accounts are in the workspace. */
  otherMembers: number;
  /** True when deleting the account would also delete the workspace. */
  isLastMember: boolean;
}
