import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle, Home, LayoutDashboard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isPublicPath } from '@/lib/tokenStorage';

/**
 * What a person sees when a page fails to render, instead of a blank white
 * screen. No stack trace and no error text — the detail goes to the browser
 * console for whoever is debugging. Public pages offer "Return Home"; the
 * signed-in app offers "Return to Dashboard".
 */

/** A deploy replaced the code this tab was still using; only a reload helps. */
function isStaleBundle(error: unknown): boolean {
  const text = String((error as Error)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(text);
}

interface FallbackProps {
  error?: unknown;
  onRetry: () => void;
}

export function ErrorFallback({ error, onRetry }: FallbackProps) {
  const stale = isStaleBundle(error);
  const isPublic = isPublicPath(window.location.pathname);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16" role="alert" aria-live="assertive">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-status-danger-surface text-status-danger-foreground">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale
            ? 'HRISense was updated while this page was open. Reload to continue.'
            : "We couldn't display this section. Try again, or go back and continue from there."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={stale ? () => window.location.reload() : onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {stale ? 'Reload' : 'Try Again'}
          </Button>
          {/* A full navigation, so whatever broke is left behind completely. */}
          <Button variant="outline" className="gap-2" onClick={() => window.location.assign(isPublic ? '/' : '/dashboard')}>
            {isPublic ? (
              <>
                <Home className="h-4 w-4" aria-hidden="true" /> Return Home
              </>
            ) : (
              <>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Return to Dashboard
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** An address no route matches. */
export function PageNotFound() {
  // Both ways out: the Dashboard sends a signed-out visitor to Sign In.
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This address does not exist in HRISense. It may have been mistyped or moved.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" className="gap-2" onClick={() => window.location.assign('/')}>
            <Home className="h-4 w-4" aria-hidden="true" /> Return Home
          </Button>
          <Button className="gap-2" onClick={() => window.location.assign('/dashboard')}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The router's error component: a page that threw while rendering or loading. */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  console.error('[HRISense] A page failed to render:', error);
  return (
    <ErrorFallback
      error={error}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

interface BoundaryState {
  error: unknown;
}

/**
 * Last line of defence around the whole app (providers, toaster, router), for
 * anything the router's own boundary does not cover.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[HRISense] The app failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
