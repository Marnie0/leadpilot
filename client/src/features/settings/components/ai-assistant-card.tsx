import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { useAiSettings, useUpdateAiSettings } from '@/features/ai/api';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { AlertTriangle } from 'lucide-react';

/**
 * The workspace's opt-in for the assistant.
 *
 * The privacy paragraph is not boilerplate and is not collapsed behind a "learn
 * more". Enabling this sends customer names and enquiry text to a third party
 * whose free tier trains on what it receives; the person deciding is entitled
 * to read that on the same screen as the switch, in the language they are using
 * the app in, rather than find it in a README.
 */
export function AiAssistantCard({ canEdit }: { canEdit: boolean }) {
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const query = useAiSettings();
  const update = useUpdateAiSettings();

  const settings = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden />
          {t('settings.aiTitle')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('settings.aiDescription')}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !settings ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-9 w-40" />
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">{t('settings.aiPrivacyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.aiPrivacyBody', { provider: settings.providerName })}
              </p>
            </div>

            {settings.providerTrainsOnInput && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  {t('settings.aiTrainingWarning', { provider: settings.providerName })}
                </AlertDescription>
              </Alert>
            )}

            {!settings.configured && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>{t('settings.aiUnconfigured')}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {settings.enabled ? t('settings.aiEnabled') : t('settings.aiDisabled')}
                </p>
                {settings.enabled && (
                  <p className="text-xs text-muted-foreground">
                    {t('settings.aiUsage', {
                      used: format.number(settings.usedToday),
                      limit: format.number(settings.dailyLimit),
                    })}
                  </p>
                )}
              </div>

              {canEdit ? (
                <Button
                  variant={settings.enabled ? 'outline' : 'default'}
                  size="sm"
                  disabled={update.isPending}
                  onClick={() => {
                    const next = !settings.enabled;
                    update.mutate(
                      { enabled: next },
                      {
                        onSuccess: () =>
                          toast.success(
                            next ? t('settings.aiTurnedOn') : t('settings.aiTurnedOff'),
                          ),
                        onError: (error) =>
                          toast.error(t('settings.couldNotChangeAi'), {
                            description: describeError(error),
                          }),
                      },
                    );
                  }}
                >
                  {update.isPending && <Loader2 className="size-4 animate-spin" />}
                  {settings.enabled ? t('common.turnOff') : t('settings.aiEnable')}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t('settings.aiManagerOnly')}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
