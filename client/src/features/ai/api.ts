import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiSettingsDto,
  AiUsageDto,
  LeadInsightDto,
  Locale,
  UpdateAiSettingsInput,
  WorkspaceSummaryResultDto,
} from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { timeZoneParam } from '@/lib/time-zone';

export interface InsightResponse {
  insight: LeadInsightDto | null;
  usage: AiUsageDto;
}

/**
 * The stored analysis for a lead.
 *
 * A plain read — it never calls the model — so it is safe to fire on every page
 * view, and the response carries the workspace's remaining budget so the card
 * can say what a click will cost before it is clicked.
 */
export function useLeadInsight(leadId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.leads.insight(leadId),
    queryFn: () => api.get<InsightResponse>(`/leads/${leadId}/insight`),
    enabled: options.enabled ?? true,
    // An analysis is a stored artefact that only changes when somebody asks for
    // a new one, so there is nothing to gain from refetching it on focus.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateInsight(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) =>
      api.post<InsightResponse>(`/leads/${leadId}/insight`, { locale }),
    onSuccess: (data) => {
      // Written straight into the cache rather than invalidated: the response
      // is the new analysis, and a refetch would put a spinner over a card the
      // user is already reading.
      queryClient.setQueryData(queryKeys.leads.insight(leadId), data);
    },
  });
}

export function useDeleteInsight(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>(`/leads/${leadId}/insight`),
    onSuccess: () => {
      queryClient.setQueryData<InsightResponse>(queryKeys.leads.insight(leadId), (previous) =>
        previous ? { ...previous, insight: null } : previous,
      );
    },
  });
}

export function useAiSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: async () => (await api.get<{ settings: AiSettingsDto }>('/ai/settings')).settings,
    enabled: options.enabled ?? true,
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAiSettingsInput) =>
      (await api.patch<{ settings: AiSettingsDto }>('/ai/settings', input)).settings,
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.aiSettings, settings);
      // Every lead's card reads `usage.enabled`, so they all have to hear about
      // the switch being thrown.
      void queryClient.invalidateQueries({ queryKey: queryKeys.leads.details() });
    },
  });
}

/* ------------------------------------------------------------------ *
 * The whole-workspace briefing
 * ------------------------------------------------------------------ */

/**
 * The stored briefing.
 *
 * A plain read that never calls the model, so it is safe on every dashboard
 * view — and the response carries the workspace's remaining budget, so the card
 * can say what a click will cost before it is clicked.
 */
export function useWorkspaceSummary(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.aiSummary,
    queryFn: () =>
      api.get<WorkspaceSummaryResultDto>('/ai/summary', { params: { ...timeZoneParam } }),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateWorkspaceSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) =>
      api.post<WorkspaceSummaryResultDto>(
        '/ai/summary',
        { locale },
        { params: { ...timeZoneParam } },
      ),
    onSuccess: (data) => {
      // Written straight in: the response *is* the new briefing, and a refetch
      // would put a spinner over something the reader is already reading.
      queryClient.setQueryData(queryKeys.aiSummary, data);
    },
  });
}

export function useDeleteWorkspaceSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>('/ai/summary'),
    onSuccess: () => {
      queryClient.setQueryData<WorkspaceSummaryResultDto>(queryKeys.aiSummary, (previous) =>
        previous ? { ...previous, summary: null } : previous,
      );
    },
  });
}
