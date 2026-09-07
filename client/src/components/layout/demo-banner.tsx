import { FlaskConical } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useAuth } from '@/features/auth/auth-context';

/**
 * Slim notice shown only inside a demo sandbox.
 *
 * Visitors need to know two things: nothing they do here is shared with anyone
 * else, and the workspace is temporary. Without that, changing data feels risky
 * and losing it later feels like a bug.
 */
export function DemoBanner() {
  const { user } = useAuth();
  if (!user?.organization.isDemo) return null;

  const expiresAt = user.organization.expiresAt;
  const remaining = expiresAt ? formatDistanceToNowStrict(new Date(expiresAt)) : null;

  return (
    <div className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center sm:px-6">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-foreground">
        <FlaskConical className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium">This is your own private demo workspace.</span>
        <span className="text-muted-foreground">
          Edit anything — no one else sees it
          {remaining ? `, and it is removed in ${remaining}.` : '.'}
        </span>
      </p>
    </div>
  );
}
