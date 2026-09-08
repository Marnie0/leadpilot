import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@leadpilot/shared';
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useFormError } from '@/features/auth/use-form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api-client';
import { useI18n, useT } from '@/lib/i18n';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';

/**
 * Asking for a reset link.
 *
 * The confirmation says the same thing whatever was typed — "if there is an
 * account, we have sent a link" — because saying anything more precise would
 * turn this form into a free membership check for every address somebody cares
 * to try. The API answers identically for the same reason; this screen simply
 * does not undo that.
 */
export function ForgotPasswordPage() {
  const t = useT();
  const { locale } = useI18n();
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: useLocalizedResolver(zodResolver(forgotPasswordSchema)),
    defaultValues: { email: '' },
  });
  const { formError, handleError, clearFormError } = useFormError(form.setError);

  const onSubmit = async (values: ForgotPasswordInput) => {
    clearFormError();
    try {
      await api.post('/auth/forgot-password', { ...values, locale });
      setSent(true);
    } catch (error) {
      handleError(error);
    }
  };

  if (sent) {
    return (
      <AuthLayout title={t('auth.checkYourInbox')} subtitle={t('auth.resetSentBody')}>
        <Alert>
          <MailCheck className="size-4" />
          <AlertDescription>{t('auth.resetSentNeutral')}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link to="/login">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('auth.backToSignIn')}
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.workEmail')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('auth.sendResetLink')}
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('auth.backToSignIn')}
          </Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
