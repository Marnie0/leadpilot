import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirmationMatches } from '@leadpilot/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/auth-context';
import {
  useAccountDeletionStatus,
  useDeleteAccount,
  useDeleteWorkspace,
  useWorkspaceDeletionSummary,
} from '@/features/settings/api';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';

/**
 * Closing your account, and closing the workspace.
 *
 * ## Why the owner is told before they try
 *
 * An owner with colleagues cannot delete their account — the workspace would be
 * left with nobody who can administer it. The status is fetched up front so the
 * screen can say that plainly and name both ways out (hand it over on the Team
 * screen, or delete the workspace here) rather than presenting a button whose
 * only outcome is a rejection after a typed password.
 *
 * ## Two proofs, not one
 *
 * Password *and* a typed confirmation, matching the other irreversible actions
 * in the app but one step stronger: the typed word is friction against a
 * misclick, the password is proof it is the account holder and not somebody who
 * found an unlocked laptop. Everything else destructive here removes records a
 * colleague could recreate; this removes the ability to sign in at all.
 *
 * ## What survives
 *
 * Leads, notes and history stay with the workspace and lose their author —
 * every reference is `SetNull`, so a colleague's timeline never develops holes.
 * The copy says so, because "delete my account" reads like it might take the
 * pipeline with it, and for the last member of a workspace it genuinely does.
 */
export function DangerZoneCard() {
  const t = useT();
  const user = useCurrentUser();
  const describeError = useApiErrorMessage();

  const statusQuery = useAccountDeletionStatus();
  const status = statusQuery.data;

  const [dialog, setDialog] = useState<'account' | 'workspace' | null>(null);

  const summaryQuery = useWorkspaceDeletionSummary(dialog === 'workspace');

  const deleteAccount = useDeleteAccount();
  const deleteWorkspace = useDeleteWorkspace();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const open = (which: 'account' | 'workspace') => {
    setPassword('');
    setConfirmation('');
    setDialog(which);
  };

  /*
   * A hard reload rather than a navigation.
   *
   * The session is gone and every cache in the app belongs to an account that
   * no longer exists; dropping the page is the only way to be sure none of it
   * is still on screen.
   */
  const goHome = () => window.location.assign('/');

  const isOwnerBlocked = status?.reason === 'OWNER_MUST_TRANSFER';
  const expected = dialog === 'workspace' ? (summaryQuery.data?.name ?? '') : user.email;
  // Mirrors the server's own comparison, so the button is enabled exactly when
  // the request would be accepted.
  const confirmationOk = expected.length > 0 && confirmationMatches(confirmation, expected);
  const isPending = deleteAccount.isPending || deleteWorkspace.isPending;

  const submit = () => {
    if (dialog === 'workspace') {
      deleteWorkspace.mutate(
        { password, confirmName: confirmation },
        {
          onSuccess: goHome,
          onError: (error) =>
            toast.error(t('danger.couldNotDeleteWorkspace'), { description: describeError(error) }),
        },
      );
      return;
    }
    deleteAccount.mutate(
      { password, confirmEmail: confirmation },
      {
        onSuccess: goHome,
        onError: (error) =>
          toast.error(t('danger.couldNotDeleteAccount'), { description: describeError(error) }),
      },
    );
  };

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t('danger.title')}</CardTitle>
          <CardDescription>{t('danger.body')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {statusQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : isOwnerBlocked ? (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {t('danger.ownerBlocked', { count: status?.otherMembers ?? 0 })}
              </AlertDescription>
            </Alert>
          ) : status?.isLastMember ? (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>{t('danger.lastMemberNotice')}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">{t('danger.whatSurvives')}</p>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap justify-end gap-3">
          {user.isOwner && (
            <Button variant="outline" onClick={() => open('workspace')}>
              <Trash2 className="size-4" /> {t('danger.deleteWorkspace')}
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={statusQuery.isLoading || isOwnerBlocked}
            onClick={() => open('account')}
          >
            {t('danger.deleteAccount')}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle dir="auto">
              {dialog === 'workspace'
                ? t('danger.workspaceDialogTitle', { name: summaryQuery.data?.name ?? '' })
                : t('danger.accountDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'workspace'
                ? t('danger.workspaceDialogBody')
                : status?.isLastMember
                  ? t('danger.accountDialogBodyLast')
                  : t('danger.accountDialogBody')}
            </DialogDescription>
          </DialogHeader>

          {dialog === 'workspace' && summaryQuery.data && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {/*
                  Two counts in one sentence, so the plural forms are resolved
                  separately and interpolated — Arabic has six categories and
                  one `{count}` per message cannot serve both.
                */}
                {t('danger.workspaceCounts', {
                  members: t('settings.statMembers', { count: summaryQuery.data.members }),
                  leads: t('settings.statLeads', { count: summaryQuery.data.leads }),
                })}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="danger-confirm">
                {dialog === 'workspace'
                  ? t('danger.typeName', { name: summaryQuery.data?.name ?? '' })
                  : t('danger.typeEmail', { email: user.email })}
              </Label>
              <Input
                id="danger-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                dir={dialog === 'workspace' ? 'auto' : 'ltr'}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="danger-password">{t('danger.yourPassword')}</Label>
              <Input
                id="danger-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || password.length === 0 || !confirmationOk}
              onClick={submit}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {dialog === 'workspace' ? t('danger.confirmWorkspace') : t('danger.confirmAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
