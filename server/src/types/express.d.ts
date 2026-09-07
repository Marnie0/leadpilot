import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    /** Populated by `requireAuth`; absent on public routes. */
    interface AuthContext {
      userId: string;
      organizationId: string;
      role: UserRole;
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
