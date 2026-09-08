import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateInvitationInput,
  CreateRoleInput,
  InvitationDto,
  RoleDto,
  TeamMemberSummaryDto,
  UpdateRoleInput,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export interface UpdateMemberInput {
  id: string;
  /** A role row in this workspace, not a fixed tier. */
  roleId?: string;
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

/* ------------------------------------------------------------------ *
 * Invitations
 * ------------------------------------------------------------------ */

/**
 * The invitation list.
 *
 * Owner and admin only, server-side — the query is simply not run for a member,
 * so the Team page does not fire a request it knows will 403.
 */
export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invitations,
    queryFn: async () =>
      (await api.get<{ invitations: InvitationDto[] }>('/team/invitations')).invitations,
    enabled,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvitationInput) =>
      (await api.post<{ invitation: InvitationDto }>('/team/invitations', input)).invitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<{ invitation: InvitationDto }>(`/team/invitations/${id}`)).invitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
    },
  });
}

/**
 * Removing somebody.
 *
 * Invalidates the leads cache alongside the roster for the same reason a
 * deactivation does: a removed rep otherwise lingers in every assignee picker
 * until something asks the server again.
 */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/team/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.team });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

/**
 * Handing the workspace over.
 *
 * The session is refetched afterwards because the caller's *own* role changes
 * in the same request — they are an admin the moment this returns, and every
 * owner-only control on screen has to notice.
 */
export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmName }: { id: string; confirmName: string }) =>
      (
        await api.post<{ member: TeamMemberSummaryDto }>(`/team/${id}/transfer-ownership`, {
          confirmName,
        })
      ).member,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.team });
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

/**
 * The workspace's roles.
 *
 * Readable by everyone — the team screen has to render "Sales rep" beside a
 * colleague's name, which is not privileged information. Only changing them is
 * the owner's.
 */
export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: async () => (await api.get<{ roles: RoleDto[] }>('/roles')).roles,
    staleTime: 60_000,
  });
}

/**
 * Invalidates everything a role change can reach.
 *
 * A role's permissions decide what the *session* may do, so the session query
 * has to be refetched too — otherwise the owner edits a role and the interface
 * keeps offering what it no longer permits until something else happens to
 * refresh it.
 */
function useRoleInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.roles }),
      queryClient.invalidateQueries({ queryKey: queryKeys.team }),
      queryClient.invalidateQueries({ queryKey: queryKeys.session }),
    ]);
  };
}

export function useCreateRole() {
  const invalidate = useRoleInvalidation();
  return useMutation({
    mutationFn: async (input: CreateRoleInput) =>
      (await api.post<{ role: RoleDto }>('/roles', input)).role,
    onSuccess: invalidate,
  });
}

export function useUpdateRole() {
  const invalidate = useRoleInvalidation();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRoleInput & { id: string }) =>
      (await api.patch<{ role: RoleDto }>(`/roles/${id}`, input)).role,
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useRoleInvalidation();
  return useMutation({
    mutationFn: ({ id, reassignToRoleId }: { id: string; reassignToRoleId?: string }) =>
      api.delete<void>(`/roles/${id}`, { body: reassignToRoleId ? { reassignToRoleId } : {} }),
    onSuccess: invalidate,
  });
}
