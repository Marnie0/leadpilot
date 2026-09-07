import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/protected-route';
import { LoginPage } from '@/pages/login-page';
import { SignupPage } from '@/pages/signup-page';
import { LeadsPage } from '@/pages/leads-page';
import { LeadDetailPage } from '@/pages/lead-detail-page';
import { TeamPage } from '@/pages/team-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * Route table.
 *
 * Phase 1 ships the leads list, the lead detail view and the team roster.
 * `/pipeline`, `/dashboard` and `/follow-ups` are reserved for later phases and
 * are shown as disabled entries in the sidebar rather than dead links.
 */
export function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/leads" replace />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
          <Route path="/team" element={<TeamPage />} />
          {/* An unknown route for a signed-in user keeps the shell, so /pipeline
              and friends read as "not built yet" rather than a broken link. */}
          <Route path="*" element={<NotFoundPage embedded />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
