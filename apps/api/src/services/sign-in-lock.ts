/**
 * Wrong-password lockout for the browser that is failing — never for the account.
 *
 * Locking the account would let anyone who knows an email keep its owner out by
 * typing wrong passwords on purpose. The lock falls on whoever is failing
 * instead: one browser (the random id the sign-in page sends) on one network.
 * Each wrong sign-in locks that browser for longer — 15 seconds, 30 seconds,
 * 1 minute, then 15 minutes for every further one — until it signs in
 * successfully, or an hour passes with no failures. The account's owner, on
 * their own browser, is not affected.
 *
 * A request without a browser id shares one lock with every other such request
 * from its network, so scripts that leave the id out lock each other. One that
 * invents a new id for every attempt still has to pass "I'm not a robot" each
 * time and stays inside the per-network sign-in rate limits.
 *
 * Kept in memory, like the rate limiters (one API instance; a restart forgets).
 */

/** Lock after the 1st, 2nd, 3rd and every later wrong sign-in, in seconds. */
export const SIGN_IN_LOCK_STEPS_SECONDS = [15, 30, 60, 15 * 60];

/** Failures are forgotten this long after the last one (once no lock is running). */
export const SIGN_IN_FAILURE_MEMORY_MS = 60 * 60 * 1000;

/** The header the sign-in page sends its browser id in. */
export const BROWSER_ID_HEADER = 'X-Browser-Id';

const BROWSER_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_ENTRIES = 50_000;

type Entry = { failures: number; lockedUntil: number; lastFailureAt: number };

export class SignInLock {
  private entries = new Map<string, Entry>();

  constructor(
    private steps: readonly number[] = SIGN_IN_LOCK_STEPS_SECONDS,
    private memoryMs = SIGN_IN_FAILURE_MEMORY_MS,
    private now: () => number = Date.now
  ) {}

  /** One key per browser per network; a missing or malformed id becomes "none". */
  static key(ip: string | undefined, browserId: string | undefined): string {
    const id = browserId && BROWSER_ID.test(browserId) ? browserId : 'none';
    return `${ip ?? 'unknown'}|${id}`;
  }

  private entry(key: string): Entry | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    const t = this.now();
    if (e.lockedUntil <= t && t - e.lastFailureAt >= this.memoryMs) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  /** Seconds this browser must still wait before trying again; 0 when it may try. */
  secondsLeft(key: string): number {
    const e = this.entry(key);
    if (!e) return 0;
    const ms = e.lockedUntil - this.now();
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }

  /** Records a wrong sign-in and returns how many seconds the browser is now locked. */
  recordFailure(key: string): number {
    const failures = (this.entry(key)?.failures ?? 0) + 1;
    const seconds = this.steps[Math.min(failures, this.steps.length) - 1];
    const t = this.now();
    this.entries.set(key, { failures, lockedUntil: t + seconds * 1000, lastFailureAt: t });
    // Keep memory bounded even under a flood of invented browser ids.
    if (this.entries.size > MAX_ENTRIES) {
      for (const k of [...this.entries.keys()]) this.entry(k);
      if (this.entries.size > MAX_ENTRIES) this.entries.clear();
    }
    return seconds;
  }

  /** A successful sign-in clears that browser's failures. */
  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}

/** "15 seconds", "1 minute", "15 minutes". */
export function waitPhrase(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** The one lock the API uses. */
export const signInLock = new SignInLock();
