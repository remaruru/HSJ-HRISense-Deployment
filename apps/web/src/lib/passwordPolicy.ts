/**
 * Client-side mirror of the server's password policy
 * (`apps/api/src/lib/password.ts`). This exists only to give the user immediate
 * feedback — the API is what actually enforces the rules.
 */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'One special character (for example ! @ # $)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** 0–100, one equal step per satisfied rule. */
/** Requirements met by the password, out of all `PASSWORD_RULES`. */
export function passwordRulesMet(password: string): { met: number; total: number } {
  return { met: password ? PASSWORD_RULES.filter((rule) => rule.test(password)).length : 0, total: PASSWORD_RULES.length };
}

/** Strength bar width: requirements met ÷ requirements × 100. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  return Math.round((passed / PASSWORD_RULES.length) * 100);
}

export const PASSWORD_POLICY_DESCRIPTION =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';
