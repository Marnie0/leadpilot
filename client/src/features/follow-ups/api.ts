import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  FollowUpCountsDto,
  FollowUpDto,
  FollowUpQueryInput,
  Paginated,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { timeZoneParam } from '@/lib/time-zone';
import { useInvalidateFollowUps } from '@/features/leads/api';

/** The subset of the query the inbox actually drives. */
export type FollowUpListParams = Partial<
  Pick<
    FollowUpQueryInput,
    'bucket' | 'q' | 'assignedToId' | 'page' | 'pageSize' | 'sortBy' | 'sortDir'
  >
>;

/**
 * Serialises the array filter the way the API's `csvArray` expects to read it,
 * and attaches the reader's timezone — every bucket boundary depends on it.
 */
function toParams(params: FollowUpListParams): Record<string, unknown> {
  const { assignedToId, ...rest } = params;
  return {
    ...rest,
    ...timeZoneParam,
    ...(assignedToId?.length && { assignedToId: assignedToId.join(',') }),
  };
}

export function useFollowUps(params: FollowUpListParams) {
  return useQuery({
    queryKey: queryKeys.followUps.list(params),
    queryFn: () => api.get<Paginated<FollowUpDto>>('/follow-ups', { params: toParams(params) }),
    // A list that visibly reorders under the cursor is worse than one a beat
    // behind, so the previous page stays put while the next one loads.
    placeholderData: (previous) => previous,
  });
}

/**
 * The bucket counts behind the tab strip.
 *
 * Keyed without `bucket`, because the counts do not vary by it — the server
 * drops it too. Sharing one cache entry across all five tabs is what stops the
 * strip flickering as you move between them.
 */
export function useFollowUpCounts(params: FollowUpListParams) {
  const { bucket: _bucket, page: _page, sortBy: _sortBy, sortDir: _sortDir, ...shared } = params;
  return useQuery({
    queryKey: queryKeys.followUps.counts(shared),
    queryFn: async () =>
      (
        await api.get<{ counts: FollowUpCountsDto }>('/follow-ups/counts', {
          params: toParams(shared),
        })
      ).counts,
    placeholderData: (previous) => previous,
  });
}

export function useCompleteFollowUpById() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome?: string }) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/complete`, { outcome }))
        .followUp,
    onSuccess: invalidate,
  });
}

/**
 * Deleting moves a follow-up to the trash; the destructive verb is separate.
 * Both invalidate the same way — a trashed task must stop being a lead's next
 * touchpoint, which is a change to the lead as much as to the follow-up.
 */
export function useTrashFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<{ followUp: FollowUpDto }>(`/follow-ups/${id}`)).followUp,
    onSuccess: invalidate,
  });
}

export function useRestoreFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/restore`)).followUp,
    onSuccess: invalidate,
  });
}

export function usePurgeFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/follow-ups/${id}/permanent`),
    onSuccess: invalidate,
  });
}

export function useCancelFollowUpById() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/cancel`)).followUp,
    onSuccess: invalidate,
  });
}

export function useRescheduleFollowUp() {
  const invalidate = useInvalidateFollowUps();
  return useMutation({
    mutationFn: async ({ id, dueAt }: { id: string; dueAt: string }) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/reschedule`, { dueAt }))
        .followUp,
    onSuccess: invalidate,
  });
}
