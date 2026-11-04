/**
 * Turns a notification's stored link into router navigation options.
 *
 * Links are app paths, optionally with a query string — for example
 * `/profile?section=medical` opens My Profile on its Medical section. The router
 * wants the path and the search values apart, so the query is split off here.
 */
export function notificationTarget(link: string): { to: string; search?: Record<string, string> } {
  const at = link.indexOf('?');
  if (at < 0) return { to: link };
  const search = Object.fromEntries(new URLSearchParams(link.slice(at + 1)));
  return { to: link.slice(0, at), search };
}
