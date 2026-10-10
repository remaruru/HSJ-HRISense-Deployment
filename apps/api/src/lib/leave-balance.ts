import { ratio } from './percent';

/**
 * THE leave balance calculation — one formula for every screen.
 *
 *   available = allotted − used − pending − forfeited
 *
 * Days in pending requests are reserved until HR decides, and forfeited days
 * cannot be used, so neither is available to file. Previously the Employee
 * dashboard and the New Request page showed `allotted − used` while the Leave
 * Balance panel showed this formula, so the same balance read differently.
 */
export interface LeaveBalanceLike {
  totalAllotted: number;
  used: number;
  pending: number;
  forfeited: number;
}

export interface LeaveBalanceFigures {
  /** allotted − used − pending − forfeited (can be negative if over-committed). */
  available: number;
  /** available ÷ allotted × 100 (null when nothing is allotted). */
  availablePercent: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function leaveBalanceFigures(b: LeaveBalanceLike): LeaveBalanceFigures {
  const available = r2(Number(b.totalAllotted) - Number(b.used) - Number(b.pending) - Number(b.forfeited));
  return { available, availablePercent: ratio(Math.max(0, available), Number(b.totalAllotted)) };
}

export function withLeaveBalanceFigures<T extends LeaveBalanceLike>(b: T): T & LeaveBalanceFigures {
  return { ...b, ...leaveBalanceFigures(b) };
}
