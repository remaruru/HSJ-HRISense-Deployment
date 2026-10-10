/**
 * When sign-in must show the "I'm not a robot" checkbox.
 *
 * Normal sign-in has no checkbox. After repeated failures — for one email, or
 * from one network — the checkbox is required until a successful sign-in or
 * until the window passes. Counting by the typed email (not by account) treats
 * existing and non-existing emails the same, so the checkbox never reveals
 * whether an account exists.
 *
 * Counters live in memory, like the rate limiters (single API instance).
 */

export const LOGIN_CAPTCHA_RULES = {
  /** Wrong sign-ins for one email before the checkbox is required. */
  perEmail: 3,
  /** Wrong sign-ins from one network (any email) before the checkbox is required there. */
  perIp: 10,
  /** How long failures are remembered. */
  windowMs: 15 * 60 * 1000,
};

type Entry = { count: number; resetAt: number };

export class LoginCaptchaTracker {
  private entries = new Map<string, Entry>();

  constructor(
    private rules = LOGIN_CAPTCHA_RULES,
    private now: () => number = Date.now
  ) {}

  private static emailKey(email: string) {
    return `email:${email.trim().toLowerCase()}`;
  }

  private static ipKey(ip: string | undefined) {
    return `ip:${ip ?? 'unknown'}`;
  }

  private count(key: string): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    if (e.resetAt <= this.now()) {
      this.entries.delete(key);
      return 0;
    }
    return e.count;
  }

  private bump(key: string) {
    const current = this.count(key);
    const existing = this.entries.get(key);
    this.entries.set(key, {
      count: current + 1,
      resetAt: existing && current > 0 ? existing.resetAt : this.now() + this.rules.windowMs,
    });
    // Keep memory bounded even under a flood of different emails.
    if (this.entries.size > 50_000) {
      const t = this.now();
      for (const [k, v] of this.entries) if (v.resetAt <= t) this.entries.delete(k);
      if (this.entries.size > 50_000) this.entries.clear();
    }
  }

  /** True when this email or this network must pass the checkbox to sign in. */
  isRequired(email: string, ip: string | undefined): boolean {
    return (
      this.count(LoginCaptchaTracker.emailKey(email)) >= this.rules.perEmail ||
      this.count(LoginCaptchaTracker.ipKey(ip)) >= this.rules.perIp
    );
  }

  /** Records a failed sign-in; returns whether the checkbox is now required. */
  recordFailure(email: string, ip: string | undefined): boolean {
    this.bump(LoginCaptchaTracker.emailKey(email));
    this.bump(LoginCaptchaTracker.ipKey(ip));
    return this.isRequired(email, ip);
  }

  /** A successful sign-in clears that email's failures (the network's count runs out on its own). */
  recordSuccess(email: string) {
    this.entries.delete(LoginCaptchaTracker.emailKey(email));
  }
}

/** The one tracker the API uses. */
export const loginCaptcha = new LoginCaptchaTracker();
