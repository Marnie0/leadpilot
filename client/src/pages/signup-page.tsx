import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN_LENGTH, signupFormSchema, type SignupFormValues } from '@leadpilot/shared';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useAuth } from '@/features/auth/auth-context';
import { useFormError } from '@/features/auth/use-form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/lib/i18n';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';

export function SignupPage() {
  const { t, locale } = useI18n();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: useLocalizedResolver(zodResolver(signupFormSchema)),
    defaultValues: {
      name: '',
      email: '',
      organizationName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { formError, handleError, clearFormError } = useFormError(form.setError);

  const onSubmit = async (values: SignupFormValues) => {
    clearFormError();
    try {
      // `confirmPassword` is a client-only field; the API never sees it.
      const { confirmPassword: _confirmPassword, ...payload } = values;
      // The account is created in the language this form was filled in, so the
      // interface does not flip the moment the session loads.
      await signup({ ...payload, locale });
      navigate('/leads', { replace: true });
    } catch (error) {
      handleError(error);
    }
  };

  const errors = form.formState.errors;

  return (
    <AuthLayout
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">{t('auth.yourName')}</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder={t('auth.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            {...form.register('name')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">{t('auth.companyName')}</Label>
          <Input
            id="organizationName"
            autoComplete="organization"
            placeholder={t('auth.companyPlaceholder')}
            aria-invalid={Boolean(errors.organizationName)}
            {...form.register('organizationName')}
          />
          {errors.organizationName && (
            <p className="text-sm text-destructive">{errors.organizationName.message}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('auth.companyHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.workEmail')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            // Latin-scripted regardless of the interface language: an address
            // typed into an RTL field would otherwise reorder as you type.
            dir="ltr"
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.createPassword')}
              className="pe-10"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('auth.passwordHint', { count: PASSWORD_MIN_LENGTH })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={t('auth.confirmPlaceholder')}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {t('auth.createWorkspace')}
        </Button>
      </form>
    </AuthLayout>
  );
}
