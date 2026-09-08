import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  FollowUpCountsDto,
  FollowUpDto,
  FollowUpQueryInput,
  Paginated,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { useInvalidateFollowUps } from '@/features/leads/api';

/** The subset of the query the inbox actually drives. */
export type FollowUpListParams = Partial<
  Pick<FollowUpQueryInput, 'bucket' | 'q' | 'assignedToId' | 'page' | 'pageSize' | 'sortDir'>
>;

/** Serialises the array filter the way the API's `csvArray` expects to read it. */
function toParams(params: FollowUpListParams): Record<string, unknown> {
  const { assignedToId, ...rest } = params;
  return { ...rest, ...(assignedToId?.length && { assignedToId: assignedToId.join(',') }) };
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
  const { bucket: _bucket, page: _page, ...shared } = params;
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
