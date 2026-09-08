import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MailWarning, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthAcknowledgementDto } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/**
 * "Confirm your email address."
 *
 * ## Why it is a banner and not a wall
 *
 * Nothing in the product is gated on verification. The deployment's sender may
 * be unable to reach the address at all — Resend's shared sender only delivers
 * to the account holder — so blocking on delivery would mean a mail
 * configuration locking somebody out of a workspace they own. An unconfirmed
 * address is a *recoverability* problem for that person, not a permission
 * problem for the product, and this is sized accordingly.
 *
 * Dismissal is per-session rather than stored: it should stop nagging somebody
 * who is busy, without quietly disappearing forever the one time it mattered.
 */
const DISMISS_KEY = 'leadpilot.verifyBannerDismissed';

export function VerifyEmailBanner() {
  const t = useT();
  const user = useCurrentUser();
  const describeError = useApiErrorMessage();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const resend = useMutation({
    mutationFn: () => api.post<AuthAcknowledgementDto>('/auth/resend-verification'),
  });

  // A demo sandbox is thrown away within the day and its addresses are
  // generated — telling a visitor to confirm one would be noise.
  if (user.emailVerified || dismissed || user.organization.isDemo) return null;

  return (
    <div className="border-b bg-amber-500/10 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1.5">
        <MailWarning className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-100">
          <span className="font-medium">{t('auth.unverifiedTitle')}</span>{' '}
          <span className="opacity-90">{t('auth.unverifiedBody')}</span>
        </p>

        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => toast.success(t('auth.verificationResent')),
              onError: (error) =>
                toast.error(t('auth.couldNotResend'), { description: describeError(error) }),
            })
          }
        >
          {t('auth.resendVerification')}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-amber-900 dark:text-amber-100"
          aria-label={t('auth.dismiss')}
          onClick={() => {
            setDismissed(true);
            try {
              window.sessionStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // Not remembering the dismissal is not a reason to refuse it.
            }
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
