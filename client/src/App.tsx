import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/protected-route';
import { LandingPage } from '@/pages/landing-page';
import { LoginPage } from '@/pages/login-page';
import { SignupPage } from '@/pages/signup-page';
import { LeadsPage } from '@/pages/leads-page';
import { LeadDetailPage } from '@/pages/lead-detail-page';
import { TeamPage } from '@/pages/team-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { FullPageSpinner } from '@/components/common/full-page-spinner';

/*
 * The board and the dashboard are the only screens that need drag-and-drop and
 * the charting library respectively, and between them those are the two
 * heaviest dependencies in the app. Loading them lazily keeps the initial
 * bundle — which every user pays for on the login screen — down to the code
 * that actually renders it.
 */
const PipelinePage = lazy(() =>
  import('@/pages/pipeline-page').then((module) => ({ default: module.PipelinePage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);

/**
 * Route table.
 *
 * Phase 1 shipped the leads list, the lead detail view and the team roster;
 * Phase 2 added the pipeline board and the dashboard; phase 3 the public
 * landing page. `/follow-ups` is reserved for a later phase and shows as a
 * disabled sidebar entry rather than a dead link.
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
          <Route path="/team" element={<TeamPage />} />
          {/* An unknown route for a signed-in user keeps the shell, so
              /follow-ups reads as "not built yet" rather than a broken link. */}
          <Route path="*" element={<NotFoundPage embedded />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
