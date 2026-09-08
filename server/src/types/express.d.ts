import type { Permission } from '@leadpilot/shared';

declare global {
  namespace Express {
    /** Populated by `requireAuth`; absent on public routes. */
    interface AuthContext {
      userId: string;
      organizationId: string;
      /**
       * The caller's permissions, resolved from their role row on every
       * request — alongside the user lookup that was already happening, so a
       * role edited elsewhere takes effect on the next request rather than at
       * token expiry.
       */
      permissions: Permission[];
      /** Ownership is not a permission; see `lib/permissions.ts`. */
      isOwner: boolean;
      /** The role itself, for anything that needs to name it. */
      role: { id: string; key: string | null; name: string; nameAr: string };
      email: string;
      name: string;
    }

    interface Request {
      auth?: AuthContext;
      /** Correlates every log line emitted while handling one request. */
      id?: string;
    }
  }
}

export {};
