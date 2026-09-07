import type { LeadDetailDto } from '@leadpilot/shared';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n';
import { useApiErrorMessage } from '@/lib/i18n/errors';
import { useAssignLead, type TeamMemberDetail } from '../api';

const NO_ASSIGNEE = '__none__';

export function LeadAssigneeSelect({
  lead,
  members,
}: {
  lead: LeadDetailDto;
  members: TeamMemberDetail[];
}) {
  const t = useT();
  const describeError = useApiErrorMessage();
  const assignLead = useAssignLead(lead.id);

  // A deactivated rep still assigned to this lead must remain listed, or the
  // Select would render an empty value and silently offer to clear it.
  const options = members.filter((member) => member.isActive || member.id === lead.assignedTo?.id);

  return (
    <Select
      value={lead.assignedTo?.id ?? NO_ASSIGNEE}
      disabled={assignLead.isPending}
      onValueChange={(value) => {
        assignLead.mutate(
          { assignedToId: value === NO_ASSIGNEE ? null : value },
          {
            onSuccess: (updated) =>
              toast.success(
                updated.assignedTo
                  ? t('lead.assignedTo', { name: updated.assignedTo.name })
                  : t('lead.nowUnassigned'),
              ),
            onError: (error) =>
              toast.error(t('lead.couldNotReassign'), { description: describeError(error) }),
          },
        );
      }}
    >
      <SelectTrigger size="sm" className="w-full" aria-label={t('lead.assignedRep')}>
        {assignLead.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {t('common.saving')}
          </span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ASSIGNEE}>{t('common.unassigned')}</SelectItem>
        {options.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: member.avatarColor }}
                aria-hidden
              />
              {member.name}
              {!member.isActive && t('common.deactivatedSuffix')}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
