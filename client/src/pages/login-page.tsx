import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@leadpilot/shared';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useAuth } from '@/features/auth/auth-context';
import { useFormError } from '@/features/auth/use-form-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginPage() {
  const { login, startDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { formError, handleError, clearFormError } = useFormError(form.setError);

  const onSubmit = async (values: LoginInput) => {
    clearFormError();
    try {
      await login(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/leads', { replace: true });
    } catch (error) {
      handleError(error);
    }
  };

  const [isStartingDemo, setStartingDemo] = useState(false);

  /**
   * Opens a private sandbox rather than signing into a shared account, so
   * anything a visitor changes is invisible to the next one.
   */
  const handleStartDemo = async () => {
    clearFormError();
    setStartingDemo(true);
    try {
      await startDemo();
      navigate('/leads', { replace: true });
    } catch (error) {
      handleError(error);
    } finally {
      setStartingDemo(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where your pipeline left off."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
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
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              // Wording rather than a row of dots: a masked placeholder reads as
              // an already-filled field, and people hit Sign in without typing.
              placeholder="Enter your password"
              className="pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-dashed bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Just want a look around?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Opens your own private workspace with 96 leads and a full activity history. Change
          anything you like — nobody else sees it, and it is removed after a day.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={handleStartDemo}
          disabled={isStartingDemo || form.formState.isSubmitting}
        >
          {isStartingDemo && <Loader2 className="size-4 animate-spin" />}
          {isStartingDemo ? 'Preparing your workspace…' : 'Start a demo'}
        </Button>
      </div>
    </AuthLayout>
  );
}
