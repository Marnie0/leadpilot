import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/features/auth/auth-context';
import { useI18n } from '@/lib/i18n';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';
import { VerifyEmailBanner } from './verify-email-banner';
import { DemoBanner } from './demo-banner';

/**
 * Application chrome.
 *
 * Desktop keeps a persistent 260px sidebar; below `lg` the same navigation
 * moves into a slide-over sheet behind a hamburger, so there is one nav
 * component and two presentations rather than two implementations.
 */
export function AppShell() {
  const { user } = useAuth();
  const { t, isRtl } = useI18n();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the drawer on navigation, including browser back/forward.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="px-5 py-5">
          <Link
            to="/leads"
            className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
        </div>

        <div className="scrollbar-slim flex-1 overflow-y-auto px-3">
          <SidebarNav />
        </div>

        <div className="border-t border-sidebar-border p-3">
          {user && (
            <p className="mb-2 truncate px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {user.organization.name}
            </p>
          )}
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('nav.openNavigation')}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            {/*
              The drawer slides in from whichever edge the reading direction
              starts at, so it opens under the hamburger rather than across
              the page from it.
            */}
            <SheetContent side={isRtl ? 'right' : 'left'} className="w-[264px] bg-sidebar p-0">
              <SheetHeader className="px-5 py-5">
                <SheetTitle className="sr-only">{t('nav.navigation')}</SheetTitle>
                <Logo />
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3">
                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
              </div>
              <div className="border-t border-sidebar-border p-3">
                <UserMenu />
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/leads" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </Link>

          <div className="shrink-0">
            <UserMenu compact />
          </div>
        </header>

        <DemoBanner />

        {/* Above the content rather than inside it, so it appears on every
            screen without each page having to remember to render it. */}
        <VerifyEmailBanner />

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
