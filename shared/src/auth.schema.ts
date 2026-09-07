import { z } from 'zod';
import { LOCALES, USER_ROLES } from './enums.js';
import { idSchema, requiredTrimmed } from './common.js';

export const PASSWORD_MIN_LENGTH = 10;

/**
 * Deliberately modest rules: length does more for entropy than symbol classes,
 * and heavy composition rules push users toward predictable substitutions.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  .max(128, { message: 'Password must be 128 characters or fewer' })
  .refine((value) => /[a-zA-Z]/.test(value), {
    message: 'Password must contain at least one letter',
  })
  .refine((value) => /[0-9]/.test(value), {
    message: 'Password must contain at least one number',
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: 'Email is required' })
  .max(254)
  .email({ message: 'Enter a valid email address' });

export const signupSchema = z.object({
  name: requiredTrimmed('Your name', 80, 2),
  email: emailSchema,
  password: passwordSchema,
  organizationName: requiredTrimmed('Company name', 80, 2),
});
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Client-side signup form: adds the confirmation field the API does not need.
 */
export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string().min(1, { message: 'Please confirm your password' }) })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SignupFormValues = z.infer<typeof signupFormSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Password is required' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: requiredTrimmed('Your name', 80, 2).optional(),
  locale: z.enum(LOCALES).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
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
  avatarColor: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    defaultCurrency: string;
  };
}

export const teamMemberIdSchema = z.object({ id: idSchema });
