import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Bell, BellOff, Cake, CheckCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { useNotifications } from '@/hooks/useNotifications';

const PAGE_SIZE = 20;

/**
 * Notifications feed.
 *
 * Everything here comes from `GET /notifications`. Notifications are raised by
 * real system events (leave workflow, evaluations, training) — nothing is
 * simulated, and an empty feed shows an honest empty state.
 */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markRead,
    markAllRead,
  } = useNotifications();

  useEffect(() => {
    loadNotifications({ unreadOnly, limit: PAGE_SIZE, page });
  }, [loadNotifications, unreadOnly, page]);

  const openNotification = (notification: { id: string; isRead: boolean; link: string | null }) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) navigate({ to: notification.link as any });
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-4xl mx-auto"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          subtitle="Updates about your leave requests, evaluations, and training."
          badgeText={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadNotifications({ unreadOnly, limit: PAGE_SIZE, page })}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button size="sm" onClick={markAllRead} disabled={isLoading || unreadCount === 0}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Filter */}
      <motion.div variants={staggerItem} className="flex items-center gap-2">
        <Button
          variant={unreadOnly ? 'outline' : 'primary'}
          size="sm"
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
        >
          All
        </Button>
        <Button
          variant={unreadOnly ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Button>
      </motion.div>

      {/* List */}
      <motion.div
        variants={staggerItem}
        className="bg-surface border-2 border-border rounded-2xl overflow-hidden shadow-sm"
      >
        {error ? (
          <div className="p-10 text-center">
            <p className="text-sm text-danger-dark">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-14 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BellOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold font-heading text-foreground">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {unreadOnly
                ? 'You have read everything. Switch to All to see your earlier notifications.'
                : 'HRISense will notify you here about your leave requests, evaluations, and training.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  onClick={() => openNotification(notification)}
                  className={cn(
                    'w-full text-left px-5 py-4 hover:bg-muted transition-colors flex items-start gap-4',
                    !notification.isRead && 'bg-primary-50/50 dark:bg-primary-950/20'
                  )}
                >
                  {/* A birthday reads at a glance; everything else keeps the bell. */}
                  {notification.type === 'BIRTHDAY_REMINDER' ? (
                    <div className="h-9 w-9 rounded-xl bg-status-accent-surface border border-status-accent-border flex items-center justify-center shrink-0 mt-0.5">
                      <Cake className="h-4.5 w-4.5 text-status-accent-foreground" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-foreground">{notification.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    {notification.link && (
                      <p className="text-xs text-primary-600 font-semibold mt-1.5 dark:text-primary-300">Open</p>
                    )}
                  </div>
                  {!notification.isRead && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-500 shrink-0 mt-2" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* Pagination */}
      {(page > 1 || notifications.length === PAGE_SIZE) && (
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={notifications.length < PAGE_SIZE || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
