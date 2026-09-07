import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { FullPageSpinner } from '@/components/common/full-page-spinner';

/**
 * Gate for every authenticated route.
 *
 * This is a UX guard, not a security boundary — the API authorises every request
 * independently, so bypassing this in the browser reveals nothing.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner label="Checking your session…" />;

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user out of the login and signup screens. */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname;
    return <Navigate to={from ?? '/leads'} replace />;
  }

  return <Outlet />;
}
