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
import { ApiError } from '@/lib/api-client';
import { useAssignLead, type TeamMemberDetail } from '../api';

const NO_ASSIGNEE = '__none__';

export function LeadAssigneeSelect({
  lead,
  members,
}: {
  lead: LeadDetailDto;
  members: TeamMemberDetail[];
}) {
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
                  ? `Assigned to ${updated.assignedTo.name}`
                  : 'Lead is now unassigned',
              ),
            onError: (error) =>
              toast.error('Could not reassign', {
                description: error instanceof ApiError ? error.message : 'Please try again.',
              }),
          },
        );
      }}
    >
      <SelectTrigger size="sm" className="w-full" aria-label="Assigned rep">
        {assignLead.isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
        {options.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: member.avatarColor }}
                aria-hidden
              />
              {member.name}
              {!member.isActive && ' (deactivated)'}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
