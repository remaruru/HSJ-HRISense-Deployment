import { Router, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { NotificationService } from '../services/notification.service';

const router = Router();
router.use(authenticate);

/** GET /notifications — the caller's own notifications. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await NotificationService.list(req.user!.userId, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      unreadOnly: req.query.unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  })
);

/** GET /notifications/unread-count — drives the sidebar badge and TopNav bell. */
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await NotificationService.unreadCount(req.user!.userId);
    res.json({ success: true, data: { unreadCount: count } });
  })
);

/**
 * Open live streams, so a shutdown can end them. Otherwise every open tab holds
 * `server.close()` for the whole forced-exit grace period on each restart.
 */
const openStreams = new Set<Response>();

export function endNotificationStreams(): void {
  for (const stream of openStreams) stream.end();
  openStreams.clear();
}

/** Streams end after this long and the client reconnects with its current token. */
const STREAM_LIFETIME_MS = 10 * 60_000;
/** Comment lines keep proxies from closing an idle connection. */
const HEARTBEAT_MS = 25_000;

/**
 * GET /notifications/stream — Server-Sent Events with the caller's unread count:
 * once on connect, then every time it changes (a notification raised for them,
 * or one they read in another tab). This is what makes the bell live.
 *
 * The web app opens it with fetch(), so the normal Bearer header is sent —
 * EventSource cannot send headers, and the token must never go in the URL.
 */
router.get('/stream', (req, res) => {
  const userId = req.user!.userId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: pass events through unbuffered
  });
  res.flushHeaders();

  let closed = false;
  let queue = Promise.resolve();
  // Counts are sent in order, one at a time, so a burst can never deliver an
  // older number after a newer one.
  const sendCount = () => {
    queue = queue.then(async () => {
      if (closed) return;
      try {
        const unreadCount = await NotificationService.unreadCount(userId);
        if (!closed) res.write(`event: unread\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
      } catch {
        // A failed count is skipped; the next change (or the client's fallback
        // poll) brings the number back in line.
      }
    });
  };

  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);
  const lifetime = setTimeout(() => res.end(), STREAM_LIFETIME_MS);
  const unsubscribe = NotificationService.onChange(userId, sendCount);
  openStreams.add(res);

  // `res` 'close' fires when the browser goes away or the stream is ended
  // (req 'close' can fire as soon as a GET's empty body has been read).
  res.on('close', () => {
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    unsubscribe();
    openStreams.delete(res);
  });

  sendCount();
});

/** PATCH /notifications/read-all — declared before /:id/read so it is matched. */
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const result = await NotificationService.markAllRead(req.user!.userId);
    res.json({ success: true, ...result, message: 'All notifications marked as read' });
  })
);

/** PATCH /notifications/:id/read */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const updated = await NotificationService.markRead(req.params.id, req.user!.userId);
    res.json({ success: true, data: updated });
  })
);

export default router;
