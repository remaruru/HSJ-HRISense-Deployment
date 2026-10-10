import { Prisma } from '@prisma/client';

/**
 * THE definition of "the active workforce", in one place.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Attendance Tally, the Attendance report and the AI fact sheet each answer
 * "how many attendance records are there for this period". They must agree.
 *
 * They did not. Tally and Reports both filtered employees by
 * `{ deletedAt: null, employmentState: 'ACTIVE' }`; the AI fact sheet queried
 * `attendanceRecord` with a date filter and no employee scoping at all. On this
 * deployment every attendance row belongs to a non-active employee, so AI
 * Assistance reported 20 records where Reports and Tally reported 0.
 *
 * Worse, the fact sheet computed
 *   daysWithNoImportedRecord = (activeEmployees × days) − distinctEmployeeDays
 * where the first term counted only active employees and the second counted
 * everybody — subtracting a wider population from a narrower one, understating
 * the ingestion gap and letting `Math.max(0, …)` clamp a real gap to zero.
 *
 * Duplicating the filter a fourth time would invite the same drift again, so the
 * definition lives here and every consumer imports it.
 *
 * ── The definition ────────────────────────────────────────────────────────────
 * An employee is part of the active workforce when they are not archived
 * (`deletedAt` is null) AND their employment state is ACTIVE.
 *
 * Employees on leave, or archived after separation, are deliberately excluded
 * from workforce counts. Their historical records still exist and remain visible
 * on their own 201 profile — this filter governs aggregate reporting only.
 */

/** Employee-table filter for the active workforce. */
export const ACTIVE_WORKFORCE_WHERE: Prisma.EmployeeWhereInput = {
  deletedAt: null,
  employmentState: 'ACTIVE',
};

/**
 * Nested filter for any model with an `employee` relation, so a query on
 * attendance, leave, training, etc. can be scoped to the same population.
 *
 * Usage: `where: { date: {...}, employee: ACTIVE_WORKFORCE_EMPLOYEE_RELATION }`
 */
export const ACTIVE_WORKFORCE_EMPLOYEE_RELATION = {
  deletedAt: null,
  employmentState: 'ACTIVE' as const,
};

/**
 * Active-workforce filter with optional organisation narrowing applied on top.
 * Keeps report/tally/AI filters identical apart from the org dimensions.
 */
export function activeWorkforceWhere(filters?: {
  unitId?: string | null;
  departmentId?: string | null;
  jobRoleId?: string | null;
}): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { ...ACTIVE_WORKFORCE_WHERE };
  if (filters?.unitId) where.unitId = filters.unitId;
  if (filters?.departmentId) where.departmentId = filters.departmentId;
  if (filters?.jobRoleId) where.jobRoleId = filters.jobRoleId;
  return where;
}
