import { useCurrentUser } from '@/features/auth/auth-context';
import { asCurrency } from '@/lib/money';

/**
 * The `display` query parameter, for any request that returns a total.
 *
 * The server needs to know which currency to convert aggregates into, and only
 * the browser knows the reader's choice. Sent explicitly rather than looked up
 * server-side for the same reason `tz` is: it keeps the aggregate endpoints
 * from having to load the caller's profile, and it keeps the query cache keyed
 * on the thing that actually changes the answer — so switching currency
 * refetches instead of serving a total drawn in the previous one.
 */
export function useDisplayParam(): { display?: string } {
  const user = useCurrentUser();
  const preferred = asCurrency(user.displayCurrency);
  return preferred ? { display: preferred } : {};
}
