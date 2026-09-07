import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/logo';
import { useT } from '@/lib/i18n';

/**
 * @param embedded renders inside the app shell, so a signed-in user who lands on
 * an unknown route keeps the sidebar and can navigate out. The standalone
 * variant is for unauthenticated visitors, who have no shell around them.
 */
export function NotFoundPage({ embedded = false }: { embedded?: boolean }) {
  const t = useT();

  if (embedded) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{t('error.notFoundTitle')}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{t('error.notFoundEmbedded')}</p>
        </div>
        <Button asChild>
          <Link to="/leads">{t('error.backToLeads')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" aria-hidden />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('error.notFoundTitle')}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t('error.notFoundStandalone')}</p>
      </div>
      <Button asChild>
        <Link to="/leads">{t('error.goToLeads')}</Link>
      </Button>
    </div>
  );
}
