import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { createQueryClient } from '@/lib/query-client';
import { AuthProvider } from '@/features/auth/auth-context';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { ThemeProvider } from './theme-provider';

/**
 * Provider stack, outermost first.
 *
 * Order matters: the router must sit above AuthProvider (which redirects), and
 * the query client above AuthProvider (which owns the session query).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Created in state so React's strict-mode double render does not build two
  // clients and orphan the first one's cache.
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <TooltipProvider delayDuration={300}>
                {children}
                <Toaster />
              </TooltipProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
