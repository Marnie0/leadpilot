import { useQuery } from '@tanstack/react-query';
import type { DashboardDto, DashboardRange } from '@leadpilot/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: queryKeys.dashboard.range(range),
    queryFn: async () =>
      (await api.get<{ dashboard: DashboardDto }>('/dashboard', { params: { range } })).dashboard,
    // Switching range keeps the previous figures on screen while the next set
    // loads, so the whole page does not blank out on a control that people
    // toggle back and forth.
    placeholderData: (previous) => previous,
    // These are aggregates over the whole workspace; they do not need to be
    // as fresh as a lead the user is editing.
    staleTime: 60_000,
  });
}
