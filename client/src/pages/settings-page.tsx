import { Info } from 'lucide-react';
import { MANAGER_ROLES } from '@leadpilot/shared';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/common/error-state';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useOrganizationSettings } from '@/features/settings/api';
import { BaseCurrencyCard } from '@/features/settings/components/base-currency-card';
import { PasswordCard } from '@/features/settings/components/password-card';
import { ProfileCard } from '@/features/settings/components/profile-card';
import { AiAssistantCard } from '@/features/settings/components/ai-assistant-card';
import { WorkspaceCard } from '@/features/settings/components/workspace-card';
import { WorkspaceHistoryCard } from '@/features/settings/components/workspace-history-card';
import { useT } from '@/lib/i18n';

/** Placeholder shaped like the cards it stands in for, so the layout does not
 *  jump when the real thing arrives. */
function CardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows * 2 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Settings, in two tabs: the things that are yours, and the things the
 * workspace shares. The split matters because the second set is mostly
 * read-only for most people, and mixing them would put half a form behind a
 * permission on every screen.
 */
export function SettingsPage() {
  const t = useT();
  const user = useCurrentUser();
  const settingsQuery = useOrganizationSettings();

  const isManager = MANAGER_ROLES.includes(user.role);
  const isOwner = user.role === 'OWNER';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />

      {user.organization.isDemo && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{t('settings.demoNotice')}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('settings.tabProfile')}</TabsTrigger>
          <TabsTrigger value="workspace">{t('settings.tabWorkspace')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileCard />
          <PasswordCard />
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6">
          {settingsQuery.isError ? (
            <Card>
              <ErrorState
                error={settingsQuery.error}
                onRetry={() => void settingsQuery.refetch()}
                title={t('settings.couldNotLoad')}
              />
            </Card>
          ) : settingsQuery.isLoading || !settingsQuery.data ? (
            <>
              <CardSkeleton rows={2} />
              <CardSkeleton rows={1} />
            </>
          ) : (
            <>
              <WorkspaceCard organization={settingsQuery.data} canEdit={isManager} />
              <BaseCurrencyCard organization={settingsQuery.data} isOwner={isOwner} />
              <AiAssistantCard canEdit={isManager} />
              <WorkspaceHistoryCard />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
