import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/**
 * GET /dashboard/stats for the role dashboards, with a real error state: when
 * it fails, `error` says so and the cards show "—", never a misleading "0".
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data?.data ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'The dashboard figures could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { stats, isLoading, error, reload };
}
