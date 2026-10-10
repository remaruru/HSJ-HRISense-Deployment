import bcrypt from 'bcryptjs';
import { generateSecurePassword } from './passwordGenerator';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Single authoritative temporary-password generator.
 *
 * Delegates to `generateSecurePassword`, which uses `crypto.randomInt` and
 * guarantees at least one uppercase, lowercase, digit and symbol so the produced
 * value always satisfies PASSWORD_POLICY below. `Math.random()` must never be
 * used for credentials anywhere in HRISense.
 */
export const generateTemporaryPassword = (): string => generateSecurePassword(14);

/**
 * The single source of truth for password complexity.
 * `apps/web/src/lib/passwordPolicy.ts` mirrors these rules for client-side hints;
 * this module is what actually enforces them.
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  /** Human-readable requirement list, reused verbatim in API error messages. */
  description:
    'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
} as const;

/**
 * Validates a candidate password against PASSWORD_POLICY.
 *
 * Implemented with explicit character-class tests rather than one large regex —
 * the previous single-regex implementation contained an escaped `\\d` inside a
 * regex literal, which required a literal backslash-d in the password and
 * therefore rejected every ordinary password.
 */
export function validatePasswordComplexity(password: string): { valid: boolean; message?: string } {
  if (typeof password !== 'string' || password.length < PASSWORD_POLICY.minLength) {
    return { valid: false, message: PASSWORD_POLICY.description };
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasLower || !hasUpper || !hasDigit || !hasSymbol) {
    return { valid: false, message: PASSWORD_POLICY.description };
  }
  return { valid: true };
}
