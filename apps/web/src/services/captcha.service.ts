import { publicApi } from './api';

export interface CaptchaConfig {
  enabled: boolean;
  siteKey: string | null;
}

let cached: Promise<CaptchaConfig> | null = null;

/**
 * Whether the "I'm not a robot" checkbox is switched on, and its public site
 * key. An "on" answer is kept for the page's life; an "off" answer (or a failed
 * request) is asked again next time, so keys added later are picked up without
 * a full reload. Either way the API still refuses a protected request without a
 * valid checkbox.
 */
export function getCaptchaConfig(): Promise<CaptchaConfig> {
  if (!cached) {
    const request = publicApi
      .get('/auth/captcha-config')
      .then((r) => (r.data?.data ?? { enabled: false, siteKey: null }) as CaptchaConfig)
      .catch(() => ({ enabled: false, siteKey: null }) as CaptchaConfig)
      .then((c) => {
        if (!(c.enabled && c.siteKey)) cached = null;
        return c;
      });
    cached = request;
  }
  return cached;
}
