import { useState, useEffect, useCallback } from 'react';
import { AnnouncementService } from '@/services/announcement.service';
import { useAuth } from './useAuth';

// Global listener set for synchronous state updates across all mounted components (Sidebar, Dashboard, Feed)
let globalUnreadCount: number = 0;
let hasInitialFetch = false;
const listeners = new Set<(count: number) => void>();

function notifyListeners(count: number) {
  globalUnreadCount = Math.max(0, count);
  listeners.forEach((listener) => listener(globalUnreadCount));
}

export function useAnnouncementUnread() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(globalUnreadCount);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      notifyListeners(0);
      return;
    }
    try {
      const count = await AnnouncementService.getUnreadCount();
      notifyListeners(count);
    } catch (err) {
      // Gracefully handle if user has no employee link or endpoint is unavailable
      notifyListeners(0);
    }
  }, [user]);

  useEffect(() => {
    const handleUpdate = (count: number) => {
      setUnreadCount(count);
    };

    listeners.add(handleUpdate);

    // Initial fetch on mount if user is logged in
    if (user && !hasInitialFetch) {
      hasInitialFetch = true;
      fetchUnreadCount();
    } else if (user) {
      // Sync initial state from global
      setUnreadCount(globalUnreadCount);
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, [user, fetchUnreadCount]);

  const refreshUnreadCount = useCallback(async () => {
    await fetchUnreadCount();
  }, [fetchUnreadCount]);

  const decrementUnreadCount = useCallback(() => {
    notifyListeners(Math.max(0, globalUnreadCount - 1));
  }, []);

  return {
    unreadCount,
    refreshUnreadCount,
    decrementUnreadCount,
  };
}
