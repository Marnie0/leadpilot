import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param inline sizes the spinner for a region inside the app shell rather
 * than the whole viewport — a lazily loaded route already has a sidebar and a
 * header around it, and a full-height spinner underneath them pushes the page
 * into a scroll it does not need.
 */
export function FullPageSpinner({ label, inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        inline ? 'min-h-[60svh]' : 'min-h-svh bg-background',
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label ?? 'Loading…'}</p>
    </div>
  );
}
