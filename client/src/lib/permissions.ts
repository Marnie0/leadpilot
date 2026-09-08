import type { Permission } from '@leadpilot/shared';
import { useCurrentUser } from '@/features/auth/auth-context';

/**
 * What the person at the keyboard is allowed to do.
 *
 * Read straight off the session, which carries the caller's role and its
 * permission set. The server enforces the same rules on every request — this is
 * only ever used to *hide* what somebody cannot do, never to permit it, which
 * is why it can afford to be a client-side check at all.
 *
 * Hiding matters even though the server would refuse: an interface that offers
 * a button and then explains it was never allowed teaches a permission by
 * rejection. The same reasoning that already puts `canEdit` on every lead row.
 */
export function useCan(permission: Permission): boolean {
  const user = useCurrentUser();
  // The owner is never locked out of their own workspace by a role edit — the
  // server takes the same shortcut, in `lib/permissions.ts`.
  if (user.isOwner) return true;
  return user.role.permissions.includes(permission);
}

/**
 * True for the account that owns the workspace.
 *
 * For the three powers that are deliberately not permissions: managing roles,
 * transferring ownership, deleting the workspace.
 */
export function useIsOwner(): boolean {
  return useCurrentUser().isOwner;
}

/** The role's label in the reader's language, falling back to English. */
export function roleLabel(role: { name: string; nameAr?: string | null }, locale: string): string {
  if (locale !== 'ar') return role.name;
  return role.nameAr && role.nameAr.length > 0 ? role.nameAr : role.name;
}
