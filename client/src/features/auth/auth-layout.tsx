import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { AppearanceControls } from '@/components/layout/appearance-controls';
import { useT } from '@/lib/i18n';

/**
 * Two-column auth shell: the form on the reading-start side, a brand panel on
 * the other that collapses away below `lg` so the form owns the full width on a
 * phone. The grid itself needs no direction handling — a two-column grid in an
 * RTL document already lays its tracks out right to left.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useT();

  const highlights = [t('auth.brandPoint1'), t('auth.brandPoint2'), t('auth.brandPoint3')];

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </Link>
          {/* Language and theme belong here because there is no account menu to
              hold them yet, and this is the screen where someone in the wrong
              language most needs a way out. */}
          <AppearanceControls className="flex items-center gap-1" />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </div>

      {/* Decorative only — hidden from assistive tech and from small screens. */}
      <div className="relative hidden overflow-hidden bg-primary lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.16),transparent_40%)] rtl:-scale-x-100" />
        <div className="relative flex h-full flex-col justify-center gap-10 px-14 text-primary-foreground">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-[0.18em] text-primary-foreground/70 uppercase">
              {t('auth.brandEyebrow')}
            </p>
            <p className="max-w-md text-3xl leading-tight font-semibold">
              {t('auth.brandHeadline')}
            </p>
            <p className="max-w-md text-base text-primary-foreground/80">{t('auth.brandBody')}</p>
          </div>

          <ul className="space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
