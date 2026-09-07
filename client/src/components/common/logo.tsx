import { cn } from '@/lib/utils';

/**
 * Wordmark. The glyph is inline SVG rather than an image file so it inherits
 * `currentColor` and stays crisp at any size — including as the favicon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-8', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 22.5V9.5a1 1 0 0 1 1.6-.8l11.2 8.4a1 1 0 0 1-.1 1.66l-4.3 2.5"
        className="stroke-primary-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.4" cy="21.3" r="2.3" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {showText && (
        <span className="text-lg font-semibold tracking-tight text-foreground">LeadPilot</span>
      )}
    </span>
  );
}
