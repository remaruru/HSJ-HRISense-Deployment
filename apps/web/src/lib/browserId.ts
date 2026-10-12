/**
 * A random id for this browser, sent with sign-in attempts.
 *
 * Wrong passwords lock the browser that typed them, not the account (the API's
 * sign-in-lock.ts), so the API needs to tell browsers apart. The id is random
 * and says nothing about the person. When storage is blocked, the id lasts
 * until the page is closed.
 */
const STORAGE_KEY = 'hrisense.browserId';
const VALID = /^[A-Za-z0-9-]{8,64}$/;

let fallback: string | null = null;

export function getBrowserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.test(stored)) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return (fallback ??= crypto.randomUUID());
  }
}
