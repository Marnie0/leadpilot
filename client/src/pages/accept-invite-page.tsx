import { useEffect, useState } from 'react';
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
import { useI18n, useT } from '@/lib/i18n';
import { roleLabel } from '@/lib/permissions';
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
  const { locale } = useI18n();
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
  const { formError, setFormError, handleError, clearFormError } = useFormError(form.setError);

  const boundEmail = preview.data?.email ?? null;

  /*
   * Copy a bound invitation's address into the form.
   *
   * The field is rendered read-only in that case and therefore not registered,
   * so the form value stayed at its `''` default — which `emailSchema` rejects,
   * since `.optional()` permits `undefined` and not an empty string. Validation
   * then failed on a field that was not on screen, `handleSubmit` never called
   * `onSubmit`, and the button did nothing at all: no navigation, no error,
   * nothing. Filling the value is the fix; the guard below is the seatbelt.
   */
  useEffect(() => {
    if (boundEmail) form.setValue('email', boundEmail, { shouldValidate: false });
  }, [boundEmail, form]);

  /**
   * Never let a blocked submit be silent.
   *
   * React Hook Form focuses the first invalid field, which does nothing when
   * that field is not rendered. If none of the errored fields are actually on
   * screen, say so above the button rather than appearing to ignore the click.
   */
  const onInvalid = (errors: Record<string, unknown>) => {
    const anyVisible = Object.keys(errors).some((field) => {
      const element = document.getElementById(field);
      return element !== null && element.offsetParent !== null;
    });
    if (!anyVisible) setFormError(t('auth.formBlocked'));
  };

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
              role: roleLabel(invitation.role, locale),
            })
          : t('invite.subtitle', { role: roleLabel(invitation.role, locale) })
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-5" noValidate>
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
