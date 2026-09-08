import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { InvitationDto, UserRole } from '@leadpilot/shared';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useCreateInvitation } from '../api';

/**
 * Creating an invitation.
 *
 * ## The link is shown once
 *
 * Only the hash is stored, so the raw link genuinely cannot be produced again —
 * this dialog is the one and only chance to copy it. That is deliberate rather
 * than an inconvenience: a link retrievable from a list would be a standing
 * credential any admin could pick up at any time, and a leak would be
 * indistinguishable from a legitimate re-read. Losing one costs a revoke and a
 * re-issue, both of which leave a trail.
 *
 * ## Email is optional
 *
 * With an address, the invitation is *bound* — only that address can redeem it,
 * so a forwarded link fails closed — and a message goes out. Without one, it is
 * a link the sender passes on however they like, redeemable once by whoever
 * gets there first. Both are legitimate; the copy says which is which.
 */
export function InviteDialog({
  open,
  onOpenChange,
  canInviteAdmins,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the owner may issue an ADMIN invitation — the API refuses the rest. */
  canInviteAdmins: boolean;
}) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const createInvitation = useCreateInvitation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'OWNER'>>('MEMBER');
  const [created, setCreated] = useState<InvitationDto | null>(null);
  const [copied, setCopied] = useState(false);

  // A dialog that reopens showing the previous invitation's link would be both
  // confusing and a small leak of something already dealt with.
  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('MEMBER');
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  const submit = () => {
    createInvitation.mutate(
      { role, ...(email.trim() ? { email: email.trim() } : {}) },
      {
        onSuccess: (invitation) => setCreated(invitation),
        onError: (error) =>
          toast.error(t('team.couldNotInvite'), { description: describeError(error) }),
      },
    );
  };

  const copy = async () => {
    if (!created?.link) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      toast.success(t('team.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('ai.copyFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('team.inviteReadyTitle')}</DialogTitle>
              <DialogDescription>
                {/*
                  Driven by what actually happened to this message rather than
                  by whether a provider is configured — a working provider can
                  still refuse one address.
                */}
                {created.email
                  ? created.emailed
                    ? t('team.inviteSentTo', { email: created.email })
                    : t('team.inviteNotEmailed', { email: created.email })
                  : t('team.inviteLinkBody')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="invite-link">{t('team.inviteLink')}</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={created.link ?? ''} dir="ltr" />
                <Button type="button" variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {t('ai.copy')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('team.inviteLinkOnce')}</p>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t('common.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
              <DialogDescription>{t('team.inviteBody')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('team.inviteEmailLabel')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  dir="ltr"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  {email.trim() ? (
                    <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  )}
                  {email.trim() ? t('team.inviteBoundHint') : t('team.inviteOpenHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">{t('team.role')}</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as Exclude<UserRole, 'OWNER'>)}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">{t('role.MEMBER')}</SelectItem>
                    {/* Only the owner may grant admin — offering the row to an
                        admin would be offering something the API refuses. */}
                    {canInviteAdmins && <SelectItem value="ADMIN">{t('role.ADMIN')}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={submit} disabled={createInvitation.isPending}>
                {createInvitation.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('team.createInvite')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
