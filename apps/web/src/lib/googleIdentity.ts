/**
 * "Sign in with Google" (Google Identity Services) — just enough to render
 * Google's button and receive the signed ID token it returns. The token goes to
 * our API, which verifies it with Google's public keys and issues the normal
 * HRISense session. Nothing from Google is stored in the browser.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
/** If Google's script has not loaded by then, the login page says so. */
const SCRIPT_TIMEOUT_MS = 15_000;

interface CredentialResponse {
  credential?: string;
}

interface GoogleId {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    ux_mode?: 'popup';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin';
    itp_support?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline' | 'filled_black';
      size: 'large';
      text: 'continue_with';
      shape: 'pill';
      logo_alignment: 'center';
      width: number;
      locale: string;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

/** Loads Google's script once. Rejects if it cannot be reached. */
export function loadGoogleIdentity(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise<GoogleId>((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(new Error('Google sign-in could not load.'));
    };
    const timer = window.setTimeout(fail, SCRIPT_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Renders Google's "Continue with Google" button into `parent`. `onCredential`
 * receives the ID token after the person picks an account in Google's popup.
 * Closing the popup simply calls nothing — there is no pending state to undo.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
  options: { width: number; dark: boolean }
): Promise<void> {
  const id = await loadGoogleIdentity();
  id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response.credential) onCredential(response.credential);
    },
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
    context: 'signin',
    itp_support: true,
  });
  parent.replaceChildren();
  id.renderButton(parent, {
    type: 'standard',
    theme: options.dark ? 'filled_black' : 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'center',
    // HRISense is in English; Google would otherwise follow the browser's language.
    locale: 'en',
    // Google allows 200–400 px.
    width: Math.max(200, Math.min(400, Math.floor(options.width))),
  });
}
