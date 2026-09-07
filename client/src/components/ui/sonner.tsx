import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/providers/theme-provider';

/**
 * Toast host. The shadcn default pulls the theme from `next-themes`, which this
 * app does not use — it reads our own provider instead.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:shadow-lg',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
