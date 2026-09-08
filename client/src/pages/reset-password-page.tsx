import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from '@leadpilot/shared';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useFormError } from '@/features/auth/use-form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api-client';
import { useT } from '@/lib/i18n';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';

/**
 * Choosing a new password from an emailed link.
 *
 * The token is read from the query string and never shown. A missing one is
 * treated as an invalid one — the screen has nothing useful to offer without
 * it, and inviting somebody to paste a token by hand is a phishing lesson.
 */
export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: useLocalizedResolver(zodResolver(resetPasswordFormSchema)),
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  const { formError, handleError, clearFormError } = useFormError(form.setError);

  if (!token) {
    return (
      <AuthLayout title={t('auth.linkNotValid')} subtitle={t('auth.linkNotValidBody')}>
        <Button asChild variant="outline" className="w-full">
          <Link to="/forgot-password">{t('auth.requestNewLink')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  const onSubmit = async (values: ResetPasswordFormValues) => {
    clearFormError();
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      toast.success(t('auth.passwordReset'));
      // Everything is signed out by design, so there is only one place to go.
      navigate('/login', { replace: true });
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.newPassword')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pe-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('auth.setNewPassword')}
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
