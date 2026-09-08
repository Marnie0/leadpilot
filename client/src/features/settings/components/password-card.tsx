import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { changePasswordSchema, type ChangePasswordInput } from '@leadpilot/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-context';
import { useChangePassword } from '@/features/settings/api';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useLocalizedResolver } from '@/lib/i18n/zod-resolver';

/**
 * Changing a password revokes every refresh token, this session's included, so
 * the only honest thing to do afterwards is send the user to the sign-in
 * screen. The card says so before they start rather than after they are locked
 * out, and clears the client's session state on the way so no stale query
 * fires a 401 toast at their back.
 */
export function PasswordCard() {
  const t = useT();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const describeError = useApiErrorMessage();
  const changePassword = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChangePasswordInput>({
    resolver: useLocalizedResolver(zodResolver(changePasswordSchema)),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    setFormError(null);
    try {
      await changePassword.mutateAsync(values);
      toast.success(t('settings.passwordChanged'));
      // The server already cleared the cookies; this drops the cached session
      // so the redirect lands on the sign-in form rather than bouncing.
      await logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(describeError(error));
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.passwordTitle')}</CardTitle>
          <CardDescription>{t('settings.passwordBody')}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          {formError && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">{t('settings.currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              aria-invalid={Boolean(form.formState.errors.currentPassword)}
              {...form.register('currentPassword')}
            />
            {form.formState.errors.currentPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t('settings.newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              aria-invalid={Boolean(form.formState.errors.newPassword)}
              {...form.register('newPassword')}
            />
            {form.formState.errors.newPassword && (
              <p className="text-xs text-destructive">
                {form.formState.errors.newPassword.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {t('settings.changePassword')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
