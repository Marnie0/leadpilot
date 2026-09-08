import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CURRENCIES, type Currency, type OrganizationSettingsDto } from '@leadpilot/shared';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useChangeCurrency, useCurrencyPreview } from '@/features/settings/api';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { asCurrency } from '@/lib/money';

/**
 * The workspace's base currency — the unit every stored amount is in.
 *
 * Distinct from the display currency on the profile card, and the two are
 * deliberately far apart in the UI: one is a reading preference that changes
 * nothing, this one rewrites the database. The dialog exists to make that
 * difference impossible to miss, and it quotes the real numbers rather than a
 * generic "are you sure" — how many leads, at what rate, and what the pipeline
 * total becomes.
 */
export function BaseCurrencyCard({
  organization,
  isOwner,
}: {
  organization: OrganizationSettingsDto;
  isOwner: boolean;
}) {
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();

  const current = asCurrency(organization.defaultCurrency) ?? 'USD';
  const [target, setTarget] = useState<Currency>(current);
  const [isConfirming, setConfirming] = useState(false);

  const preview = useCurrencyPreview(isConfirming ? target : null);
  const changeCurrency = useChangeCurrency();

  const close = () => setConfirming(false);

  const confirm = () => {
    changeCurrency.mutate(target, {
      onSuccess: (result) => {
        close();
        toast.success(t('settings.currencyChanged', { count: result.converted }));
      },
      onError: (error) =>
        toast.error(t('settings.couldNotChangeCurrency'), { description: describeError(error) }),
    });
  };

  const rows = preview.data
    ? [
        {
          label: t('settings.currencyRate'),
          // Four decimals because some pairs move in the fourth — a rate shown
          // as "0.31" would not reproduce the totals underneath it.
          value: `1 ${preview.data.from} = ${preview.data.rate.toFixed(4)} ${preview.data.to}`,
        },
        { label: t('settings.currencyAffected'), value: format.number(preview.data.leads) },
        {
          label: t('settings.currencyTotalBefore'),
          value: format.currency(preview.data.totalBefore, preview.data.from),
        },
        {
          label: t('settings.currencyTotalAfter'),
          value: format.currency(preview.data.totalAfter, preview.data.to),
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.baseCurrencyTitle')}</CardTitle>
        <CardDescription>{t('settings.baseCurrencyBody')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-2 sm:max-w-xs">
        <Label htmlFor="base-currency">{t('settings.baseCurrencyTitle')}</Label>
        <Select
          value={target}
          disabled={!isOwner}
          onValueChange={(value) => setTarget(value as Currency)}
        >
          <SelectTrigger id="base-currency" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((code) => (
              <SelectItem key={code} value={code}>
                {code} · {t(`currency.${code}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>

      <CardFooter className="justify-end gap-3">
        {!isOwner ? (
          <p className="me-auto text-xs text-muted-foreground">
            {t('settings.baseCurrencyOwnerOnly')}
          </p>
        ) : (
          <Button
            variant="outline"
            disabled={target === current}
            onClick={() => setConfirming(true)}
          >
            {target === current ? t('settings.currencyUnchanged') : t('settings.changeCurrency')}
          </Button>
        )}
      </CardFooter>

      <Dialog open={isConfirming} onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.currencyDialogTitle', { code: target })}</DialogTitle>
            <DialogDescription>{t('settings.currencyDialogLead')}</DialogDescription>
          </DialogHeader>

          {preview.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{describeError(preview.error)}</AlertDescription>
            </Alert>
          ) : preview.isLoading || !preview.data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <>
              <dl className="divide-y rounded-lg border text-sm">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 px-3 py-2"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium text-foreground tabular-nums">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                {t('currency.ratesAsOf', { date: format.date(preview.data.asOf) })} ·{' '}
                {t('currency.attribution')}
              </p>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={changeCurrency.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={changeCurrency.isPending || !preview.data}
              onClick={confirm}
            >
              {changeCurrency.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('settings.currencyConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
