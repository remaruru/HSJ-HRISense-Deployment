import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

/** Mirrors `DashboardOverview` in apps/api/src/services/dashboard-overview.service.ts. */
export type OverviewTone = 'danger' | 'warning' | 'review' | 'positive' | 'neutral';

export interface TodoItem {
  id: string;
  kind:
    | 'leave' | 'compliance' | 'evaluation' | 'application' | 'training'
    | 'note' | 'interview' | 'record' | 'holiday' | 'onboarding' | 'supervisor';
  title: string;
  context: string;
  date: string | null;
  link: string;
  tone: OverviewTone;
}

/** One of the signed-in person's OWN actions (never anyone else's). `activity`
 *  in the overview is their latest few, across days; the full history pages
 *  through GET /dashboard/activity?before=…|asOf=YYYY-MM-DD. */
export interface ActivityItem {
  id: string;
  title: string;
  context: string;
  at: string;
  link: string | null;
}

export interface DashboardOverview {
  scope: 'organization' | 'team' | 'self';
  compliance: { actionRequired: number; needsReview: number; expiringSoon: number };
  todo: TodoItem[];
  activity: ActivityItem[];
}

/**
 * Near-real-time: refreshed every minute while the tab is visible, as soon as
 * the person comes back to the tab, and on demand (`reload`) — the calendar
 * calls it after every note change so "Added a note" appears straight away.
 * Background refreshes never flash the loading skeleton.
 */
const POLL_MS = 60_000;

export function useDashboardOverview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setIsLoading(true);
    try {
      const res = await api.get('/dashboard/overview');
      setData(res.data?.data ?? null);
      setError(null);
    } catch {
      // Keep showing the last good data on a failed background refresh.
      if (!loadedOnce.current) setError('Your to-do list and activity could not be loaded.');
    } finally {
      loadedOnce.current = true;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { data, isLoading, error, reload: load };
}
