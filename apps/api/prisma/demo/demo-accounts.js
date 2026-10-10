/**
 * Demo accounts — the rules every demo seeder shares.
 *
 * Demo logins use the reserved `example.com` domain (RFC 2606). That is
 * deliberate: nobody can own a mailbox or a Google account for it, so a
 * stranger can never take a demo account over through "Forgot password" or
 * "Continue with Google". (`gmail.com` addresses such as hr@gmail.com belong to
 * real people.)
 *
 * The demo password is never stored in source code. The seeders read it from
 * the DEMO_ACCOUNT_PASSWORD environment variable, check it against the same
 * rules the API enforces, and store only a bcrypt hash — hashed exactly like
 * src/lib/password.ts does.
 */

'use strict';

const bcrypt = require('bcryptjs');

const DEMO_EMAIL_DOMAIN = 'example.com';
const DEMO_PASSWORD_ENV = 'DEMO_ACCOUNT_PASSWORD';

/** Must match SALT_ROUNDS in src/lib/password.ts. */
const BCRYPT_ROUNDS = 12;

/** Mirrors PASSWORD_POLICY / validatePasswordComplexity in src/lib/password.ts. */
const PASSWORD_RULE =
  'at least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character';

function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/**
 * The demo password from the environment. Throws (without ever echoing the
 * value) when it is missing or would be refused by the login rules.
 */
function getDemoPassword() {
  const password = process.env[DEMO_PASSWORD_ENV];
  if (!password) {
    throw new Error(`${DEMO_PASSWORD_ENV} is not set. Set it in the environment to the password the demo accounts should use.`);
  }
  if (!isValidPassword(password)) {
    throw new Error(`${DEMO_PASSWORD_ENV} does not meet the HRISense password rules: ${PASSWORD_RULE}.`);
  }
  return password;
}

function hashDemoPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** `hr` → `hr@example.com`; an address on another domain keeps its local part. */
function demoEmail(localPartOrEmail) {
  const local = String(localPartOrEmail).trim().toLowerCase().split('@')[0];
  return `${local}@${DEMO_EMAIL_DOMAIN}`;
}

function isDemoEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

module.exports = {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD_ENV,
  BCRYPT_ROUNDS,
  PASSWORD_RULE,
  isValidPassword,
  getDemoPassword,
  hashDemoPassword,
  demoEmail,
  isDemoEmail,
};
