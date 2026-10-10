/**
 * Single, authoritative token store for HRISense.
 *
 * "Remember me" decides WHERE the tokens live:
 *   • checked   → `localStorage`   — the session survives a browser restart.
 *   • unchecked → `sessionStorage` — the session ends when the tab/browser closes.
 *
 * Both the axios client and the AuthProvider use this module, so there is exactly
 * one session mechanism rather than two divergent ones.
 */

/**
 * Routes that render without a session. Used to suppress the "session expired"
 * toast and the blocking session-restore screen on public pages.
 */
const PUBLIC_PATH_PREFIXES = ['/careers'];
const PUBLIC_EXACT_PATHS = ['/', '/login', '/forgot-password', '/reset-password'];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const PERSIST_KEY = 'hrisense_remember_me';

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — the session simply will not persist */
  }
}

function safeRemove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True when the user asked to stay signed in. */
export function isRemembered(): boolean {
  return safeGet(localStorage, PERSIST_KEY) === 'true';
}

function activeStore(): Storage {
  return isRemembered() ? localStorage : sessionStorage;
}

export const tokenStorage = {
  /**
   * Records the Remember Me choice. Must be called BEFORE `setTokens` on login so
   * the tokens land in the right store.
   */
  setRemember(remember: boolean): void {
    if (remember) {
      safeSet(localStorage, PERSIST_KEY, 'true');
    } else {
      safeRemove(localStorage, PERSIST_KEY);
    }
  },

  isRemembered,

  /** Reads from whichever store currently holds the session. */
  getAccessToken(): string | null {
    return safeGet(sessionStorage, ACCESS_KEY) ?? safeGet(localStorage, ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return safeGet(sessionStorage, REFRESH_KEY) ?? safeGet(localStorage, REFRESH_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    const store = activeStore();
    const other = store === localStorage ? sessionStorage : localStorage;
    // Never leave a copy behind in the store we are not using.
    safeRemove(other, ACCESS_KEY);
    safeRemove(other, REFRESH_KEY);
    safeSet(store, ACCESS_KEY, accessToken);
    safeSet(store, REFRESH_KEY, refreshToken);
  },

  setAccessToken(accessToken: string): void {
    safeSet(activeStore(), ACCESS_KEY, accessToken);
  },

  /** Removes tokens from BOTH stores. The Remember Me preference is kept. */
  clear(): void {
    safeRemove(localStorage, ACCESS_KEY);
    safeRemove(localStorage, REFRESH_KEY);
    safeRemove(sessionStorage, ACCESS_KEY);
    safeRemove(sessionStorage, REFRESH_KEY);
  },
};
