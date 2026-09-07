import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/** Uniform failure panel for any query that errors on first load. */
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const t = useT();
  const describe = useApiErrorMessage();

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title ?? t('common.couldNotLoad')}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{describe(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RotateCw className="size-3.5" /> {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
