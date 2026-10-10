/**
 * Google reCAPTCHA v2 ("I'm not a robot" checkbox) — loading the script and
 * rendering a checkbox. The token it produces is sent to the HRISense API, which
 * checks it with Google using the secret key; the browser only ever has the
 * public site key.
 */

const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=en&onload=__hrisenseRecaptchaReady';
const SCRIPT_TIMEOUT_MS = 15_000;

interface Grecaptcha {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      theme?: 'light' | 'dark';
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ) => number;
  reset: (widgetId?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __hrisenseRecaptchaReady?: () => void;
  }
}

let loading: Promise<Grecaptcha> | null = null;

export function loadRecaptcha(): Promise<Grecaptcha> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (loading) return loading;
  loading = new Promise<Grecaptcha>((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(new Error('The robot check could not load.'));
    };
    const timer = window.setTimeout(fail, SCRIPT_TIMEOUT_MS);
    window.__hrisenseRecaptchaReady = () => {
      window.clearTimeout(timer);
      if (window.grecaptcha?.render) resolve(window.grecaptcha);
      else fail();
    };
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}
