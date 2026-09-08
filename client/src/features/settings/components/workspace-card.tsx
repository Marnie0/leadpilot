import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { OrganizationSettingsDto } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateOrganization } from '@/features/settings/api';
import { useFormat, useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/**
 * Workspace name, address and headline counts.
 *
 * The organisation's default language lives in the schema and is set at sign-up
 * from the founder's own, but it is not offered here: nothing reads it until
 * there is an invite flow to apply it to, and a control that changes a value
 * with no consumer is worse than no control.
 *
 * Visible to everybody, editable by managers. A rep who cannot see the
 * workspace's settings cannot tell whether the figures they are reading are in
 * the currency they think they are — so the read is open and only the controls
 * are gated.
 */
export function WorkspaceCard({
  organization,
  canEdit,
}: {
  organization: OrganizationSettingsDto;
  canEdit: boolean;
}) {
  const t = useT();
  const format = useFormat();
  const describeError = useApiErrorMessage();
  const updateOrganization = useUpdateOrganization();

  const [name, setName] = useState(organization.name);

  const trimmedName = name.trim();
  const patch = { ...(trimmedName !== organization.name && { name: trimmedName }) };
  const isDirty = Object.keys(patch).length > 0;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isDirty || !canEdit) return;
    updateOrganization.mutate(patch, {
      onSuccess: () => toast.success(t('settings.saved')),
      onError: (error) =>
        toast.error(t('settings.couldNotSave'), { description: describeError(error) }),
    });
  };

  const stats = [
    t('settings.statMembers', { count: organization.counts.members }),
    t('settings.statLeads', { count: organization.counts.leads }),
    ...(organization.counts.archivedLeads > 0
      ? [t('settings.statArchived', { count: organization.counts.archivedLeads })]
      : []),
    t('settings.createdOn', { date: format.date(organization.createdAt) }),
  ];

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.workspaceTitle')}</CardTitle>
          <CardDescription>
            {t('settings.workspaceBody', { organization: organization.name })}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">{t('settings.fieldWorkspaceName')}</Label>
            <Input
              id="workspace-name"
              value={name}
              dir="auto"
              maxLength={80}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-slug">{t('settings.fieldSlug')}</Label>
            <Input id="workspace-slug" value={organization.slug} disabled dir="ltr" />
            <p className="text-xs text-muted-foreground">{t('settings.slugHint')}</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm text-muted-foreground">{stats.join(' · ')}</p>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-3">
          {!canEdit ? (
            <p className="me-auto text-xs text-muted-foreground">{t('settings.readOnly')}</p>
          ) : (
            <Button type="submit" disabled={!isDirty || updateOrganization.isPending}>
              {updateOrganization.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('settings.save')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
