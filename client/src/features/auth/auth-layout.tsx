import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/common/logo';

const HIGHLIGHTS = [
  'Every enquiry captured, assigned and followed up',
  'A shared pipeline your whole team can see',
  'Works in English and Arabic, right-to-left included',
];

/**
 * Two-column auth shell: the form on the left, a brand panel on the right that
 * collapses away below `lg` so the form owns the full width on a phone.
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
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <Link to="/" className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>

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
      <div
        className="relative hidden overflow-hidden bg-primary lg:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.16),transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-center gap-10 px-14 text-primary-foreground">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-foreground/70">
              Lead management
            </p>
            <p className="max-w-md text-3xl font-semibold leading-tight">
              Stop losing deals in a spreadsheet.
            </p>
            <p className="max-w-md text-base text-primary-foreground/80">
              LeadPilot gives small service teams one place to track every enquiry from first
              contact to signed deal.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
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
