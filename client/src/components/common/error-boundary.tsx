import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence against a render crash taking the whole app to a blank
 * page. React has no hook equivalent, so this stays a class component.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this is where a Sentry (or similar) report would go.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Something broke</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error stopped the page from rendering. Reloading usually clears it.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    );
  }
}
