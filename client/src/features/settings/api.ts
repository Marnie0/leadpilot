import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountDeletionStatusDto,
  AuthUser,
  ChangePasswordInput,
  Currency,
  CurrencyChangeResultDto,
  CurrencyPreviewDto,
  DeleteAccountInput,
  DeleteWorkspaceInput,
  OrganizationSettingsDto,
  UpdateOrganizationInput,
  UpdateProfileInput,
  WorkspaceEventDto,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export function useOrganizationSettings() {
  return useQuery({
    queryKey: queryKeys.settings.organization,
    queryFn: async () =>
      (await api.get<{ organization: OrganizationSettingsDto }>('/settings/organization'))
        .organization,
  });
}

/**
 * Saving the profile writes the response straight into the session cache rather
 * than invalidating it. The language and display currency are read from that
 * cache on every render, so a refetch round-trip would leave the UI briefly
 * showing the old preference after the form has already said "Saved".
 */
/**
 * The workspace's audit trail. Readable by every member, not just the owner:
 * the point of recording an irreversible change is that the people it affected
 * can see that it happened.
 */
export function useWorkspaceEvents() {
  return useQuery({
    queryKey: queryKeys.settings.events,
    queryFn: async () =>
      (await api.get<{ events: WorkspaceEventDto[] }>('/settings/events')).events,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) =>
      (await api.patch<{ user: AuthUser }>('/auth/me', input)).user,
    onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post<void>('/auth/change-password', input),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) =>
      (await api.patch<{ organization: OrganizationSettingsDto }>('/settings/organization', input))
        .organization,
    onSuccess: (organization) => {
      queryClient.setQueryData(queryKeys.settings.organization, organization);
      // The workspace name appears in the app chrome, which reads it from the
      // session rather than from here.
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

/**
 * What a currency change would do, fetched before it is offered.
 *
 * Enabled only once a target is chosen: the preview is the body of the
 * confirmation dialog, and there is nothing to preview until there is a
 * currency to preview against.
 */
export function useCurrencyPreview(currency: Currency | null) {
  return useQuery({
    queryKey: ['settings', 'currency-preview', currency],
    queryFn: async () =>
      (
        await api.get<{ preview: CurrencyPreviewDto }>('/settings/currency/preview', {
          params: { currency: currency as string },
        })
      ).preview,
    enabled: currency !== null,
    staleTime: 60_000,
  });
}

/**
 * Every figure the app holds is quoted in the old currency, so this clears the
 * cache wholesale rather than picking invalidations. A stale lead value here is
 * not a stale number — it is a number with the wrong unit on it.
 */
export function useChangeCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (currency: Currency) =>
      (
        await api.post<{ result: CurrencyChangeResultDto }>('/settings/currency', {
          currency,
          confirm: true,
        })
      ).result,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      });
    },
  });
}

/* ------------------------------------------------------------------ *
 * Closing an account, and closing the workspace
 * ------------------------------------------------------------------ */

/**
 * Whether this account can be deleted yet.
 *
 * Asked before the button is offered rather than after it is pressed: an owner
 * with colleagues has to hand the workspace over first, and finding that out
 * from a rejected request means typing a password to be told no.
 */
export function useAccountDeletionStatus() {
  return useQuery({
    queryKey: queryKeys.settings.deletionStatus,
    queryFn: () => api.get<AccountDeletionStatusDto>('/auth/account/deletion-status'),
    staleTime: 30_000,
  });
}

/**
 * What the workspace deletion dialog quotes back — the name to be typed, and
 * how much is about to go with it. Owner-only server-side, so the query only
 * runs once the dialog that needs it is open.
 */
export function useWorkspaceDeletionSummary(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.settings.workspaceDeletion,
    queryFn: () =>
      api.get<{ name: string; members: number; leads: number }>('/auth/workspace/deletion-summary'),
    enabled,
  });
}

/*
 * Both deletions end the session by design, and the server has already cleared
 * the cookies by the time these resolve. The caller reloads rather than
 * navigating: every cache in the app belongs to an account that no longer
 * exists, and dropping the whole page is the only honest way to forget it.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (input: DeleteAccountInput) => api.delete<void>('/auth/account', { body: input }),
  });
}

export function useDeleteWorkspace() {
  return useMutation({
    mutationFn: (input: DeleteWorkspaceInput) =>
      api.delete<void>('/auth/workspace', { body: input }),
  });
}
