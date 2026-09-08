import { QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from './api-client';

/**
 * Query keys are declared in one place so an invalidation can never drift from
 * the key it is meant to match. Keys are hierarchical: invalidating
 * `leadKeys.all` clears every list, detail and timeline in one call.
 */
export const queryKeys = {
  session: ['session'] as const,
  stages: ['stages'] as const,
  team: ['team'] as const,
  invitations: ['team', 'invitations'] as const,
  roles: ['roles'] as const,
  fxRates: ['fx-rates'] as const,
  aiSettings: ['ai', 'settings'] as const,
  aiSummary: ['ai', 'summary'] as const,
  settings: {
    organization: ['settings', 'organization'] as const,
    events: ['settings', 'events'] as const,
    deletionStatus: ['settings', 'deletion-status'] as const,
    workspaceDeletion: ['settings', 'workspace-deletion'] as const,
  },
  leads: {
    all: ['leads'] as const,
    lists: () => [...queryKeys.leads.all, 'list'] as const,
    list: (filters: unknown) => [...queryKeys.leads.lists(), filters] as const,
    stats: (filters: unknown) => [...queryKeys.leads.all, 'stats', filters] as const,
    details: () => [...queryKeys.leads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
    activities: (id: string, view: string) =>
      [...queryKeys.leads.detail(id), 'activities', view] as const,
    followUps: (id: string) => [...queryKeys.leads.detail(id), 'follow-ups'] as const,
    insight: (id: string) => [...queryKeys.leads.detail(id), 'insight'] as const,
  },
  board: {
    all: ['board'] as const,
    view: (filters: unknown) => [...queryKeys.board.all, filters] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    range: (range: string) => [...queryKeys.dashboard.all, range] as const,
  },
  followUps: {
    all: ['follow-ups'] as const,
    list: (filters: unknown) => ['follow-ups', 'list', filters] as const,
    counts: (filters: unknown) => ['follow-ups', 'counts', filters] as const,
  },
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Lead data changes on human timescales, so a short stale window avoids
        // a refetch storm while still feeling live.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry a request the server rejected on its merits — only
          // genuine network or server faults are worth a second attempt.
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Only surface background-refetch failures; a first load renders its own
        // error state, and 401s are handled by the session listener.
        if (query.state.data === undefined) return;
        if (error instanceof ApiError && error.isAuthError) return;
        toast.error('Could not refresh data', {
          description: error instanceof Error ? error.message : 'Please check your connection.',
        });
      },
    }),
  });
}
