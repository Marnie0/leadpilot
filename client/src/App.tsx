import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/protected-route';
import { LandingPage } from '@/pages/landing-page';
import { LoginPage } from '@/pages/login-page';
import { SignupPage } from '@/pages/signup-page';
import { LeadsPage } from '@/pages/leads-page';
import { LeadDetailPage } from '@/pages/lead-detail-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { FullPageSpinner } from '@/components/common/full-page-spinner';

/*
 * The board and the dashboard are the only screens that need drag-and-drop and
 * the charting library respectively, and between them those are the two
 * heaviest dependencies in the app. Loading them lazily keeps the initial
 * bundle — which every user pays for on the login screen — down to the code
 * that actually renders it.
 *
 * The landing page stays eager on purpose: it is the first paint for every
 * anonymous visitor, and putting a round-trip in front of it to save bytes
 * nobody else pays for is the wrong trade.
 */
const PipelinePage = lazy(() =>
  import('@/pages/pipeline-page').then((module) => ({ default: module.PipelinePage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);

/*
 * The three screens nobody lands on. Leads is where sign-in delivers you and
 * where most of a working day is spent; the inbox, the roster and the settings
 * forms are all a deliberate click away, so none of them belongs in the bundle
 * that has to render before the first table row does.
 */
const FollowUpsPage = lazy(() =>
  import('@/pages/follow-ups-page').then((module) => ({ default: module.FollowUpsPage })),
);
const TeamPage = lazy(() =>
  import('@/pages/team-page').then((module) => ({ default: module.TeamPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })),
);

/**
 * Route table.
 *
 * Phase 1 shipped the leads list, the lead detail view and the team roster;
 * Phase 2 added the pipeline board and the dashboard; Phase 3 the public
 * landing page; Phase 4 the follow-up inbox and settings.
 *
 * `/` is public and stays that way for signed-in visitors too: a front page
 * that redirects you the moment you have an account is one you can never send
 * anybody a link to.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/leads" element={<LeadsPage />} />
          <Route
            path="/pipeline"
            element={
              <Suspense fallback={<FullPageSpinner inline />}>
                <PipelinePage />
              </Suspense>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<FullPageSpinner inline />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
          <Route
            path="/follow-ups"
            element={
              <Suspense fallback={<FullPageSpinner inline />}>
                <FollowUpsPage />
              </Suspense>
            }
          />
          <Route
            path="/team"
            element={
              <Suspense fallback={<FullPageSpinner inline />}>
                <TeamPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<FullPageSpinner inline />}>
                <SettingsPage />
              </Suspense>
            }
          />
          {/* An unknown route for a signed-in user keeps the shell, so a
              mistyped link reads as a wrong turn rather than a broken app. */}
          <Route path="*" element={<NotFoundPage embedded />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
