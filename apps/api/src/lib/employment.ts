import { EmploymentState } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

/**
 * Employment states that mean the employment has ENDED. Each of these needs a
 * separation (end) date, and OTHERS additionally needs the reason in words —
 * the five choices HR was given are AWOL, Resigned, Retired, Terminated, Others.
 *
 * ACTIVE and ON_LEAVE are current employment: no end date, and the UI shows the
 * length of service up to today instead.
 */
export const ENDED_STATES: EmploymentState[] = [
  EmploymentState.RESIGNED,
  EmploymentState.TERMINATED,
  EmploymentState.RETIRED,
  EmploymentState.AWOL,
  EmploymentState.OTHERS,
];

export const hasEnded = (state: EmploymentState | string | null | undefined): boolean =>
  !!state && (ENDED_STATES as string[]).includes(String(state));

const day = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The only date rules the system enforces (nothing beyond what HR asked for):
 *   · an ended employment must carry its end date,
 *   · OTHERS must say why,
 *   · an end date cannot precede the start date,
 *   · someone still employed cannot carry an end date.
 *
 * `current` lets an update be validated against the values already stored, so a
 * PATCH that changes only one of the three still gets checked as a whole.
 */
export function validateEmployment(
  incoming: { employmentState?: unknown; hireDate?: unknown; separationDate?: unknown; separationReason?: unknown },
  current?: { employmentState?: EmploymentState; hireDate?: Date | null; separationDate?: Date | null; separationReason?: string | null }
): void {
  const state = (incoming.employmentState ?? current?.employmentState ?? EmploymentState.ACTIVE) as EmploymentState;
  const start = 'hireDate' in incoming ? day(incoming.hireDate) : current?.hireDate ?? null;
  const end = 'separationDate' in incoming ? day(incoming.separationDate) : current?.separationDate ?? null;
  const reasonRaw = 'separationReason' in incoming ? incoming.separationReason : current?.separationReason;
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';

  if (hasEnded(state)) {
    if (!end) {
      throw new AppError('An end date is required once the employment status is AWOL, Resigned, Retired, Terminated or Others.', 400);
    }
    if (state === EmploymentState.OTHERS && !reason) {
      throw new AppError('Please give the specific reason when the status is Others.', 400);
    }
  } else if (end) {
    throw new AppError('Remove the end date, or set a status of AWOL, Resigned, Retired, Terminated or Others.', 400);
  }

  if (start && end && end < start) {
    throw new AppError('The end date cannot be earlier than the start date.', 400);
  }
}
