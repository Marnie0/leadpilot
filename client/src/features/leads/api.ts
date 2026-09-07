import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  ActivityDto,
  ActivityQueryInput,
  AssignLeadInput,
  CreateActivityInput,
  CreateFollowUpInput,
  CreateLeadInput,
  FollowUpDto,
  LeadDetailDto,
  LeadListItemDto,
  LeadQueryInput,
  LeadStatsDto,
  MoveLeadStageInput,
  Paginated,
  PipelineStageDto,
  TeamMemberSummaryDto,
  UpdateLeadInput,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

/* ------------------------------------------------------------------ *
 * Reference data — stages and team members change rarely, so they are
 * cached for the session and shared by every screen that needs them.
 * ------------------------------------------------------------------ */

export function useStages() {
  return useQuery({
    queryKey: queryKeys.stages,
    queryFn: async () => (await api.get<{ stages: PipelineStageDto[] }>('/stages')).stages,
    staleTime: Infinity,
  });
}

export interface TeamMemberDetail extends TeamMemberSummaryDto {
  lastLoginAt: string | null;
  createdAt: string;
}

export function useTeamMembers() {
  return useQuery({
    queryKey: queryKeys.team,
    queryFn: async () => (await api.get<{ members: TeamMemberDetail[] }>('/team')).members,
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

export type LeadFilters = Partial<LeadQueryInput>;

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: queryKeys.leads.list(filters),
    queryFn: () => api.get<Paginated<LeadListItemDto>>('/leads', { params: filters }),
    // Keeps the previous page on screen while the next one loads, so paging and
    // filtering never flash an empty table.
    placeholderData: (previous) => previous,
  });
}

export function useLeadStats(filters: LeadFilters) {
  return useQuery({
    queryKey: queryKeys.leads.stats(filters),
    queryFn: async () =>
      (await api.get<{ stats: LeadStatsDto }>('/leads/stats', { params: filters })).stats,
    placeholderData: (previous) => previous,
  });
}

export function useLead(leadId: string, options?: Partial<UseQueryOptions<LeadDetailDto>>) {
  return useQuery({
    queryKey: queryKeys.leads.detail(leadId),
    queryFn: async () => (await api.get<{ lead: LeadDetailDto }>(`/leads/${leadId}`)).lead,
    ...options,
  });
}

/**
 * Invalidates every list, stat block and detail view touching leads.
 *
 * A single lead edit can change its stage counts, its position in a sorted
 * list and its timeline, so the blunt instrument is the correct one here —
 * surgical cache surgery would be far easier to get subtly wrong.
 */
function useInvalidateLeads() {
  const queryClient = useQueryClient();
  return (leadId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    if (leadId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    }
  };
}

export function useCreateLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async (input: CreateLeadInput) =>
      (await api.post<{ lead: LeadDetailDto }>('/leads', input)).lead,
    onSuccess: (lead) => invalidate(lead.id),
  });
}

export function useUpdateLead(leadId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async (input: UpdateLeadInput) =>
      (await api.patch<{ lead: LeadDetailDto }>(`/leads/${leadId}`, input)).lead,
    onSuccess: () => invalidate(leadId),
  });
}

export function useMoveLeadStage(leadId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async (input: MoveLeadStageInput) =>
      (await api.post<{ lead: LeadDetailDto }>(`/leads/${leadId}/stage`, input)).lead,
    onSuccess: () => invalidate(leadId),
  });
}

export function useAssignLead(leadId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async (input: AssignLeadInput) =>
      (await api.post<{ lead: LeadDetailDto }>(`/leads/${leadId}/assign`, input)).lead,
    onSuccess: () => invalidate(leadId),
  });
}

/** Archives a lead. The activity trail survives and an admin can restore it. */
export function useArchiveLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: (leadId: string) => api.delete<void>(`/leads/${leadId}`),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async (leadId: string) =>
      (await api.post<{ lead: LeadDetailDto }>(`/leads/${leadId}/restore`)).lead,
    onSuccess: (lead) => invalidate(lead.id),
  });
}

/* ------------------------------------------------------------------ *
 * Activity timeline
 * ------------------------------------------------------------------ */

export const ACTIVITY_PAGE_SIZE = 25;

/**
 * @param limit how many entries to fetch. The caller raises it to reveal older
 * history rather than the timeline silently stopping at a fixed ceiling.
 */
export function useLeadActivities(
  leadId: string,
  view: ActivityQueryInput['view'] = 'all',
  limit: number = ACTIVITY_PAGE_SIZE,
) {
  return useQuery({
    queryKey: [...queryKeys.leads.activities(leadId, view), limit],
    queryFn: () =>
      api.get<Paginated<ActivityDto>>(`/leads/${leadId}/activities`, {
        params: { view, pageSize: limit },
      }),
    placeholderData: (previous) => previous,
  });
}

export function useCreateActivity(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateActivityInput) =>
      (await api.post<{ activity: ActivityDto }>(`/leads/${leadId}/activities`, input)).activity,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      // A note bumps `lastActivityAt`, which the table can sort by.
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    },
  });
}

export function useDeleteActivity(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) => api.delete<void>(`/activities/${activityId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    },
  });
}

/* ------------------------------------------------------------------ *
 * Follow-ups
 * ------------------------------------------------------------------ */

export function useLeadFollowUps(leadId: string) {
  return useQuery({
    queryKey: queryKeys.leads.followUps(leadId),
    queryFn: () =>
      api.get<Paginated<FollowUpDto>>(`/leads/${leadId}/follow-ups`, {
        params: { pageSize: 50, sortBy: 'dueAt', sortDir: 'asc' },
      }),
  });
}

/** Any follow-up write also changes the lead's `nextFollowUpAt`, so both refresh. */
function useInvalidateFollowUps(leadId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.followUps.all });
  };
}

export function useCreateFollowUp(leadId: string) {
  const invalidate = useInvalidateFollowUps(leadId);
  return useMutation({
    mutationFn: async (input: CreateFollowUpInput) =>
      (await api.post<{ followUp: FollowUpDto }>(`/leads/${leadId}/follow-ups`, input)).followUp,
    onSuccess: invalidate,
  });
}

export function useCompleteFollowUp(leadId: string) {
  const invalidate = useInvalidateFollowUps(leadId);
  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome?: string }) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/complete`, { outcome }))
        .followUp,
    onSuccess: invalidate,
  });
}

export function useCancelFollowUp(leadId: string) {
  const invalidate = useInvalidateFollowUps(leadId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ followUp: FollowUpDto }>(`/follow-ups/${id}/cancel`)).followUp,
    onSuccess: invalidate,
  });
}
