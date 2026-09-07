import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, LoginInput, SignupInput } from '@leadpilot/shared';
import { api, ApiError, onSessionExpired } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

interface AuthContextValue {
  user: AuthUser | null;
  /** True only while the initial session check is in flight. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionResponse {
  user: AuthUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  /**
   * The session query is the single source of truth for "am I signed in".
   * A 401 here is an expected answer, not an error, so it resolves to `null`
   * instead of retrying or surfacing a toast.
   */
  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        const { user } = await api.get<SessionResponse>('/auth/me');
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  // When a background request finds the session is gone for good, drop every
  // cached tenant record immediately rather than leaving stale data on screen.
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(queryKeys.session, null);
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      }),
    [queryClient],
  );

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => api.post<SessionResponse>('/auth/login', input),
  });

  const signupMutation = useMutation({
    mutationFn: (input: SignupInput) => api.post<SessionResponse>('/auth/signup', input),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
  });

  const login = useCallback(
    async (input: LoginInput) => {
      const { user } = await loginMutation.mutateAsync(input);
      queryClient.setQueryData(queryKeys.session, user);
      return user;
    },
    [loginMutation, queryClient],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const { user } = await signupMutation.mutateAsync(input);
      queryClient.setQueryData(queryKeys.session, user);
      return user;
    },
    [signupMutation, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      // Clear locally even if the request failed — the cookie may already be
      // gone, and leaving another user's data cached would be worse.
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.clear();
    }
  }, [logoutMutation, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: sessionQuery.data ?? null,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: Boolean(sessionQuery.data),
      login,
      signup,
      logout,
    }),
    [sessionQuery.data, sessionQuery.isLoading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Narrowed accessor for screens that only render behind <ProtectedRoute>. */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called outside an authenticated route');
  return user;
}
