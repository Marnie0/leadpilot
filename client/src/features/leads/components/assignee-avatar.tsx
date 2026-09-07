import type { TeamMemberSummaryDto } from '@leadpilot/shared';
import { UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Assignee avatar with a name tooltip, or a dashed placeholder when the lead is
 * unassigned — unassigned is a state worth *seeing*, not an empty cell.
 */
export function AssigneeAvatar({
  member,
  showName = false,
  className,
}: {
  member: TeamMemberSummaryDto | null;
  showName?: boolean;
  className?: string;
}) {
  if (!member) {
    return (
      <span className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <span
          className="flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/40"
          aria-hidden
        >
          <UserRound className="size-3.5" />
        </span>
        {showName && <span className="text-sm">Unassigned</span>}
        {!showName && <span className="sr-only">Unassigned</span>}
      </span>
    );
  }

  const avatar = (
    <Avatar className={cn('size-7', !member.isActive && 'opacity-50')}>
      <AvatarFallback
        style={{ backgroundColor: member.avatarColor }}
        className="text-[10px] font-semibold text-white"
      >
        {initials(member.name)}
      </AvatarFallback>
    </Avatar>
  );

  if (showName) {
    return (
      <span className={cn('flex min-w-0 items-center gap-2', className)}>
        {avatar}
        <span className="truncate text-sm text-foreground">{member.name}</span>
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', className)}>{avatar}</span>
      </TooltipTrigger>
      <TooltipContent>
        {member.name}
        {!member.isActive && ' (deactivated)'}
      </TooltipContent>
    </Tooltip>
  );
}
