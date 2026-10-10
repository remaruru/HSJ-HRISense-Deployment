/**
 * Display helpers shared by My Profile and the My Team member profile. The
 * Employee Management profile keeps its own copies; these read the same stored
 * values the same way.
 */

/** Shown wherever an optional value has not been filled in yet. */
export const NOT_PROVIDED = 'Not provided';

/** A stored code such as `ON_LEAVE` → `On Leave`. */
export function formatEnumLabel(value?: string | null): string {
  if (!value) return NOT_PROVIDED;
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A stored date for display — never "Invalid Date". */
export function formatDate(value?: string | Date | null): string {
  if (!value) return NOT_PROVIDED;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? NOT_PROVIDED : date.toLocaleDateString();
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

/** First, middle, last and suffix, without stray spaces. */
export function fullNameOf(e: { firstName?: string | null; middleName?: string | null; lastName?: string | null; suffix?: string | null } | null | undefined): string {
  if (!e) return '';
  return [e.firstName, e.middleName, e.lastName, e.suffix].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
}
