import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { AuthLayout } from '@/features/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/**
 * The landing page for a verification link.
 *
 * Runs once on mount and reports what happened. The guard ref matters more than
 * it looks: React's strict mode mounts effects twice in development, and the
 * token is single-use — without it the second call spends a token the first
 * already used and the screen reports failure for a verification that worked.
 */
export function VerifyEmailPage() {
  const t = useT();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const describeError = useApiErrorMessage();
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setState('done');
        // The banner reads `emailVerified` off the session, so it has to hear.
        await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      } catch (error) {
        setMessage(describeError(error));
        setState('failed');
      }
    })();
  }, [token, queryClient, describeError]);

  if (state === 'working') {
    return (
      <AuthLayout title={t('auth.verifying')} subtitle={t('auth.verifyingBody')}>
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </AuthLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthLayout title={t('auth.verifiedTitle')} subtitle={t('auth.verifiedBody')}>
        <div className="flex justify-center py-4">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <Button asChild className="w-full">
          <Link to="/leads">{t('auth.continueToWorkspace')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.linkNotValid')} subtitle={message ?? t('auth.linkNotValidBody')}>
      <div className="flex justify-center py-4">
        <XCircle className="size-10 text-destructive" aria-hidden />
      </div>
      <Button asChild variant="outline" className="w-full">
        <Link to="/leads">{t('auth.continueToWorkspace')}</Link>
      </Button>
    </AuthLayout>
  );
}
