import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Server-side employee number generation.
 *
 * Format: `HSJ-XXXX` (zero-padded to at least 4 digits, widening automatically
 * once the organisation passes 9999 employees).
 *
 * HR never invents an employee number by hand. The value is derived from the
 * highest existing `HSJ-<digits>` value and is protected against races by the
 * unique constraint on `Employee.employeeNumber` plus a bounded retry loop in
 * `createEmployeeNumberCandidates`.
 */

export const EMPLOYEE_NUMBER_PREFIX = 'HSJ-';
const MIN_DIGITS = 4;

/** Parses `HSJ-0123` → 123. Returns null for anything that does not match. */
export function parseEmployeeNumber(employeeNumber: string): number | null {
  if (!employeeNumber.startsWith(EMPLOYEE_NUMBER_PREFIX)) return null;
  const suffix = employeeNumber.slice(EMPLOYEE_NUMBER_PREFIX.length);
  if (!/^\d+$/.test(suffix)) return null;
  const value = Number.parseInt(suffix, 10);
  return Number.isSafeInteger(value) ? value : null;
}

export function formatEmployeeNumber(sequence: number): string {
  return `${EMPLOYEE_NUMBER_PREFIX}${String(sequence).padStart(MIN_DIGITS, '0')}`;
}

/**
 * Reads every existing `HSJ-` employee number (including soft-deleted rows, so a
 * number is never reused) and returns the next free sequence value.
 */
export async function getNextEmployeeSequence(
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const existing = await client.employee.findMany({
    where: { employeeNumber: { startsWith: EMPLOYEE_NUMBER_PREFIX } },
    select: { employeeNumber: true },
  });

  let highest = 0;
  for (const row of existing) {
    const value = parseEmployeeNumber(row.employeeNumber);
    if (value !== null && value > highest) highest = value;
  }

  return highest + 1;
}

/**
 * Produces an ordered list of candidate numbers to try, so a caller can retry on
 * a unique-constraint violation without re-querying the whole table each time.
 *
 * @param attempts how many consecutive candidates to prepare
 */
export async function createEmployeeNumberCandidates(
  attempts = 5,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string[]> {
  const start = await getNextEmployeeSequence(client);
  return Array.from({ length: Math.max(1, attempts) }, (_, i) => formatEmployeeNumber(start + i));
}

/** True when a Prisma error is a unique-constraint violation on employeeNumber. */
export function isEmployeeNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => String(field).toLowerCase().includes('employeenumber'));
  }
  return String(target ?? '').toLowerCase().includes('employeenumber');
}
