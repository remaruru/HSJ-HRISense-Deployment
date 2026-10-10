import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree';
import { PageNotFound, RouteErrorFallback } from '@/components/shared/AppErrorBoundary';
import type { AuthContextType } from '../providers/AuthProvider';

export interface RouterContext {
  auth: AuthContextType;
}

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!, // Dynamically supplied by AuthProvider / InnerApp
  },
  // A page that throws shows a recoverable screen, never a blank page or a
  // stack trace; an unknown address gets a real "Page not found".
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: PageNotFound,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
