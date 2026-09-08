import { z } from 'zod';
import { msg } from './message.js';
import { LOCALES, USER_ROLES } from './enums.js';
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
  role: (typeof USER_ROLES)[number];
  locale: 'en' | 'ar';
  /** Display-only currency override. `null` means the workspace's own. */
  displayCurrency: string | null;
  avatarColor: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    defaultCurrency: string;
    /** True for a throwaway demo sandbox, so the UI can say so. */
    isDemo: boolean;
    /** When the sandbox is reaped. Null for real workspaces. */
    expiresAt: string | null;
  };
}

export const teamMemberIdSchema = z.object({ id: idSchema });
