import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CURRENCIES, LOCALES, type Currency, type Locale } from '@leadpilot/shared';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useUpdateProfile } from '@/features/settings/api';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { asCurrency } from '@/lib/money';

/** "Follow the workspace" is a real choice, not the absence of one. */
const FOLLOW_WORKSPACE = 'workspace';

/**
 * Name, language and display currency.
 *
 * All three are sent in one PATCH, but only the fields that actually changed:
 * the API rejects an empty patch, and a "Save" that posts the same three values
 * back every time makes the audit trail useless for working out what someone
 * did.
 */
export function ProfileCard() {
  const t = useT();
  const user = useCurrentUser();
  const describeError = useApiErrorMessage();
  const updateProfile = useUpdateProfile();

  const initialCurrency = asCurrency(user.displayCurrency) ?? FOLLOW_WORKSPACE;
  const [name, setName] = useState(user.name);
  const [locale, setLocale] = useState<Locale>(user.locale);
  const [currency, setCurrency] = useState<Currency | typeof FOLLOW_WORKSPACE>(initialCurrency);

  const base = asCurrency(user.organization.defaultCurrency) ?? 'USD';
  const trimmedName = name.trim();
  const patch = {
    ...(trimmedName !== user.name && { name: trimmedName }),
    ...(locale !== user.locale && { locale }),
    ...(currency !== initialCurrency && {
      displayCurrency: currency === FOLLOW_WORKSPACE ? null : currency,
    }),
  };
  const isDirty = Object.keys(patch).length > 0;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isDirty) return;
    updateProfile.mutate(patch, {
      onSuccess: () => toast.success(t('settings.saved')),
      onError: (error) =>
        toast.error(t('settings.couldNotSave'), { description: describeError(error) }),
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profileTitle')}</CardTitle>
          <CardDescription>{t('settings.profileBody')}</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-name">{t('settings.fieldName')}</Label>
            <Input
              id="settings-name"
              value={name}
              dir="auto"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-email">{t('settings.fieldEmail')}</Label>
            <Input id="settings-email" value={user.email} disabled dir="ltr" />
            <p className="text-xs text-muted-foreground">{t('settings.emailHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-locale">{t('menu.language')}</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
              <SelectTrigger id="settings-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`language.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-currency">{t('currency.display')}</Label>
            <Select
              value={currency}
              onValueChange={(value) => setCurrency(value as Currency | typeof FOLLOW_WORKSPACE)}
            >
              <SelectTrigger id="settings-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FOLLOW_WORKSPACE}>
                  {t('currency.followWorkspaceWith', { code: base })}
                </SelectItem>
                {CURRENCIES.filter((code) => code !== base).map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} · {t(`currency.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('currency.displayHint')}</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-role">{t('settings.fieldRole')}</Label>
            <Input id="settings-role" value={t(`role.${user.role}`)} disabled />
            <p className="text-xs text-muted-foreground">{t('settings.roleHint')}</p>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-3">
          <p className="me-auto text-xs text-muted-foreground">
            {isDirty ? '' : t('settings.noChanges')}
          </p>
          <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
            {updateProfile.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('settings.save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
