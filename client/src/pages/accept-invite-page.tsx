import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  acceptInvitationFormSchema,
  type AcceptInvitationFormValues,
  type InvitationPreviewDto,
} from '@leadpilot/shared';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useFormError } from '@/features/auth/use-form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { useT } from '@/lib/i18n';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';

/**
 * Accepting an invitation.
 *
 * Public: the person here has no account, and the token in the URL *is* the
 * authorisation. The preview call is what lets the screen say which workspace
 * and which role — information the holder of the link is entitled to, and that
 * nobody without it can ask for.
 *
 * When the invitation names an address the field is filled and locked, because
 * a bound invitation is only redeemable under that address and an editable box
 * would be an invitation to discover that by failing.
 */
export function AcceptInvitePage() {
  const t = useT();
  const navigate = useNavigate();
  const { token = '' } = useParams<{ token: string }>();
  const [showPassword, setShowPassword] = useState(false);

  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: async () =>
      (await api.get<{ invitation: InvitationPreviewDto }>(`/invites/${token}`)).invitation,
    retry: false,
  });

  const form = useForm<AcceptInvitationFormValues>({
    resolver: useLocalizedResolver(zodResolver(acceptInvitationFormSchema)),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const { formError, handleError, clearFormError } = useFormError(form.setError);

  if (preview.isLoading) {
    return (
      <AuthLayout title={t('invite.loadingTitle')}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <AuthLayout title={t('invite.invalidTitle')} subtitle={t('invite.invalidBody')}>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">{t('auth.backToSignIn')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  const invitation = preview.data;
  const boundEmail = invitation.email;

  const onSubmit = async (values: AcceptInvitationFormValues) => {
    clearFormError();
    try {
      await api.post(`/invites/${token}/accept`, {
        name: values.name,
        password: values.password,
        // A bound invitation ignores this server-side; sending it anyway would
        // just be noise.
        ...(boundEmail ? {} : { email: values.email }),
      });
      navigate('/login', {
        replace: true,
        state: { justSignedUp: true, email: boundEmail ?? values.email, emailSent: false },
      });
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <AuthLayout
      title={t('invite.title', { workspace: invitation.workspaceName })}
      subtitle={
        invitation.invitedByName
          ? t('invite.subtitleFrom', {
              name: invitation.invitedByName,
              role: t(`role.${invitation.role}`),
            })
          : t('invite.subtitle', { role: t(`role.${invitation.role}`) })
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
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.workEmail')}</Label>
          {boundEmail ? (
            <Input id="email" value={boundEmail} readOnly disabled dir="ltr" />
          ) : (
            <>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                aria-invalid={Boolean(form.formState.errors.email)}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
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
          {t('invite.accept')}
        </Button>
      </form>
    </AuthLayout>
  );
}
