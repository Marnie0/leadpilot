import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createTranslator, getLoadedBundle } from '@/lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence against a render crash taking the whole app to a blank
 * page. React has no hook equivalent, so this stays a class component.
 *
 * It also sits *above* the locale provider — a crash inside that provider is
 * exactly when this has to work — so it reads the language off the document
 * instead of from context. `index.html` sets `lang` before the first paint, so
 * the value is there even if nothing else ever mounted.
 *
 * It asks for whichever dictionary is already in memory rather than importing
 * one, because importing Arabic here would drag it back into the main bundle
 * and undo the split. If the crash happened before Arabic finished loading,
 * this falls back to English — which is the only honest thing it can do.
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

    const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    const t = createTranslator(locale, getLoadedBundle(locale).dictionary);

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{t('error.title')}</h1>
          <p className="max-w-md text-sm text-muted-foreground">{t('error.body')}</p>
        </div>
        <Button onClick={() => window.location.reload()}>{t('error.reload')}</Button>
      </div>
    );
  }
}
