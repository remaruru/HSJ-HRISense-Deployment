import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from './useAuth';
import { tokenStorage } from '@/lib/tokenStorage';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Shared notification state.
 *
 * A module-level listener set keeps the TopNav bell, the sidebar badge and the
 * Notifications page in step without a second fetch per component.
 */
let cachedUnreadCount = 0;
let hasInitialFetch = false;
const listeners = new Set<(count: number) => void>();

function broadcast(count: number) {
  cachedUnreadCount = Math.max(0, count);
  listeners.forEach((listener) => listener(cachedUnreadCount));
}

/**
 * The badge rule, in one place, so the bell and the sidebar can never disagree:
 * nothing at zero, the number up to 99, then `99+`.
 */
export function formatUnreadCount(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}

/**
 * Live badge.
 *
 * The API pushes the unread count over Server-Sent Events
 * (`GET /notifications/stream`) the moment it changes — a leave decision, an HR
 * calendar note, a notification read in another tab — so the bell's number
 * moves in real time. The stream is read with fetch() so the Bearer token goes
 * in a header, never in the URL.
 *
 * It is open only while the tab is visible: browsers allow ~6 connections per
 * host, and a stream held by every background tab would starve the app's own
 * requests. Coming back to the tab reconnects and re-counts at once. While the
 * stream is down (server restart, network drop) the old 60-second poll of
 * `/notifications/unread-count` keeps the badge honest.
 */
const POLL_INTERVAL_MS = 60_000;
const MIN_REFETCH_GAP_MS = 10_000;
const MAX_RETRY_DELAY_MS = 30_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let consumerCount = 0;
let lastFetchAt = 0;

let stream: AbortController | null = null;
let streamLive = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1_000;

async function fetchUnreadCount(force = false): Promise<void> {
  if (!force && Date.now() - lastFetchAt < MIN_REFETCH_GAP_MS) return;
  lastFetchAt = Date.now();
  try {
    const res = await api.get('/notifications/unread-count');
    broadcast(res.data?.data?.unreadCount ?? 0);
  } catch {
    // A failed count must never break the shell — leave the last known value.
  }
}

/** One SSE block: `event: unread` + `data: {"unreadCount":3}`. */
function handleStreamEvent(block: string) {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (event !== 'unread' || !data) return;
  try {
    broadcast(Number(JSON.parse(data).unreadCount) || 0);
    lastFetchAt = Date.now();
  } catch {
    /* malformed event — ignore it, the next one will do */
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null || consumerCount === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void openStream();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
}

async function openStream(): Promise<void> {
  if (stream || consumerCount === 0 || document.visibilityState !== 'visible') return;
  const token = tokenStorage.getAccessToken();
  if (!token) return;

  const controller = new AbortController();
  stream = controller;
  try {
    const res = await fetch(`${api.defaults.baseURL}/notifications/stream`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.status === 401) {
      // Expired access token. An ordinary API call lets the axios interceptor
      // refresh it (or sign the person out); the reconnect then uses the new one.
      await fetchUnreadCount(true);
      return;
    }
    if (!res.ok || !res.body) return;

    streamLive = true;
    retryDelay = 1_000;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        handleStreamEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch {
    // Closed on purpose, a network drop or a server restart — see below.
  } finally {
    streamLive = false;
    if (stream === controller) {
      stream = null;
      // The server also ends streams every few minutes so that a new token is
      // used; either way, reconnect unless we closed it ourselves.
      if (!controller.signal.aborted) scheduleReconnect();
    }
  }
}

function closeStream() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stream?.abort();
  stream = null;
  streamLive = false;
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    void fetchUnreadCount();
    void openStream();
  } else {
    closeStream();
  }
}

function startLiveUpdates() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => {
    // Fallback only: skipped while the live stream is delivering counts, and for
    // a tab nobody is looking at (it catches up when it is focused again).
    if (!streamLive && document.visibilityState === 'visible') void fetchUnreadCount(true);
  }, POLL_INTERVAL_MS);
  window.addEventListener('focus', handleVisibility);
  document.addEventListener('visibilitychange', handleVisibility);
  void openStream();
}

function stopLiveUpdates() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  window.removeEventListener('focus', handleVisibility);
  document.removeEventListener('visibilitychange', handleVisibility);
  closeStream();
}

export function useNotifications(options: { autoLoadList?: boolean } = {}) {
  const { autoLoadList = false } = options;
  const { user } = useAuth();

  const [unreadCount, setUnreadCount] = useState<number>(cachedUnreadCount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      broadcast(0);
      return;
    }
    await fetchUnreadCount(true);
  }, [user]);

  const loadNotifications = useCallback(
    async (params: { unreadOnly?: boolean; limit?: number; page?: number } = {}) => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get('/notifications', {
          params: {
            unreadOnly: params.unreadOnly ? 'true' : undefined,
            limit: params.limit ?? 20,
            page: params.page ?? 1,
          },
        });
        setNotifications(res.data?.data ?? []);
        broadcast(res.data?.unreadCount ?? 0);
      } catch {
        setError('Notifications could not be loaded.');
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const markRead = useCallback(async (id: string) => {
    let wasUnread = false;
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        // Marking an already-read notification must not decrement again — that
        // is how a badge drifts below the server's real count.
        if (!n.isRead) wasUnread = true;
        return n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() };
      })
    );
    if (wasUnread) broadcast(Math.max(0, cachedUnreadCount - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } finally {
      // Always reconcile with the server, so the badge, the dropdown and the
      // unread-count endpoint agree even after a retry or a double click.
      await fetchUnreadCount(true);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    broadcast(0);
    try {
      await api.patch('/notifications/read-all');
    } finally {
      await fetchUnreadCount(true);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = (count: number) => setUnreadCount(count);
    listeners.add(handleUpdate);

    if (!user) {
      // Signed out: drop the count and the timer, and allow the next sign-in to
      // fetch again rather than showing the previous user's number.
      hasInitialFetch = false;
      broadcast(0);
      return () => {
        listeners.delete(handleUpdate);
      };
    }

    if (!hasInitialFetch) {
      hasInitialFetch = true;
      void fetchUnreadCount(true);
    } else {
      setUnreadCount(cachedUnreadCount);
    }

    consumerCount += 1;
    startLiveUpdates();

    return () => {
      listeners.delete(handleUpdate);
      consumerCount -= 1;
      if (consumerCount <= 0) {
        consumerCount = 0;
        stopLiveUpdates();
      }
    };
  }, [user]);

  useEffect(() => {
    if (autoLoadList && user) {
      loadNotifications();
    }
  }, [autoLoadList, user, loadNotifications]);

  return {
    unreadCount,
    notifications,
    isLoading,
    error,
    loadNotifications,
    refreshUnreadCount,
    markRead,
    markAllRead,
  };
}
