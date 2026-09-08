import { Coins } from 'lucide-react';
import { useConversionNote, useMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * The footnote under a screen full of converted figures.
 *
 * Renders nothing when the reader is on the workspace's own currency, which is
 * most of the time — so screens can place it unconditionally. Its whole job is
 * to stop a converted number from passing as an original one: the reader is
 * told what it was converted from and how old the rate is, and if the live feed
 * was unreachable, that too.
 */
export function ConversionNote({ className }: { className?: string }) {
  const money = useMoney();
  const note = useConversionNote(money);
  if (!note) return null;

  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <Coins className="size-3.5 shrink-0" aria-hidden />
      <span>{note}</span>
    </p>
  );
}
