import { Loader2 } from 'lucide-react';

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label ?? 'Loading…'}</p>
    </div>
  );
}
