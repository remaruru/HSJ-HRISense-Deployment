import { useEffect, useRef, useState } from 'react';
import { loadRecaptcha } from '@/lib/recaptcha';
import { cn } from '@/lib/utils';

/**
 * The "I'm not a robot" checkbox (reCAPTCHA v2).
 *
 * `onToken` receives the token when the box is ticked, and `null` when it
 * expires or fails. A token works once: change `resetKey` after a failed
 * request to clear the box so the person ticks it again. `align="center"`
 * centres it under a centred form (sign-in, forgot password).
 */
export function RecaptchaCheckbox({
  siteKey,
  onToken,
  resetKey = 0,
  align = 'start',
  className,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
  align?: 'start' | 'center';
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<number | null>(null);
  const latest = useRef(onToken);
  latest.current = onToken;
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let alive = true;
    loadRecaptcha()
      .then((g) => {
        if (!alive || !host.current || widget.current !== null) return;
        widget.current = g.render(host.current, {
          sitekey: siteKey,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token) => latest.current(token),
          'expired-callback': () => latest.current(null),
          'error-callback': () => latest.current(null),
        });
        setState('ready');
      })
      .catch(() => alive && setState('unavailable'));
    return () => {
      alive = false;
    };
  }, [siteKey]);

  // Clear the box whenever the parent asks (after a failed or finished request).
  useEffect(() => {
    if (resetKey === 0 || widget.current === null) return;
    window.grecaptcha?.reset(widget.current);
    latest.current(null);
  }, [resetKey]);

  return (
    <div className={cn('min-w-0', align === 'center' && 'flex flex-col items-center text-center', className)}>
      {/* Google's checkbox is a fixed 304 px frame; it scales down on narrow phones.
          The frame is a light page: a light color scheme keeps Chrome from
          painting a white box behind it in dark mode. */}
      <div className={cn('max-[360px]:scale-90 [color-scheme:light]', align === 'center' ? 'origin-center' : 'origin-left')}>
        <div ref={host} />
      </div>
      {state === 'loading' && <div className="h-[78px] w-[304px] max-w-full animate-pulse rounded-md border border-border bg-surface-2" aria-hidden="true" />}
      {state === 'unavailable' && (
        <p role="alert" className="text-sm text-status-danger-foreground">
          The robot check could not load. Check your connection and refresh the page.
        </p>
      )}
    </div>
  );
}
