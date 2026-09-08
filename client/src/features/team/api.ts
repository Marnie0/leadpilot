import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamMemberSummaryDto, UserRole } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export interface UpdateMemberInput {
  id: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Role and activation changes, gated server-side to owners and admins.
 *
 * Deactivating also revokes the member's sessions, so every cached lead is
 * refreshed alongside the roster: a deactivated rep otherwise keeps appearing
 * in assignee pickers until something asks the server again, and offering
 * somebody who can no longer sign in is a small lie.
 */
export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateMemberInput) =>
      (await api.patch<{ member: TeamMemberSummaryDto }>(`/team/${id}`, body)).member,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.team });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
