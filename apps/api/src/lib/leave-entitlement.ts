import { LeaveType } from '@prisma/client';

/**
 * Hospicio-confirmed leave entitlement by COMPLETED years of service (anniversary
 * years from the start / hire date — see lib/service-period). The only leave
 * types with an automatic entitlement are the five below; every other type stays
 * an HR-entered (manual) allotment.
 *
 *   Vacation      < 1 year: 0 · 1 to < 3 years: 10 · 3 years or more: 15
 *   Sick          < 1 year: 0 · 1 year or more: 7
 *   Bereavement   < 1 year: 0 · 1 year or more: 5
 *   Paternity     < 1 year: 0 · 1 year or more: 7 — ONLY when HR marked the employee eligible
 *   Solo Parent   < 1 year: 0 · 1 year or more: 7 — ONLY when HR marked the employee eligible
 *
 * Eligibility for Paternity and Solo Parent leave is an explicit HR flag on the
 * employee. It is never inferred from sex, civil status, children, name or role.
 */

export interface EntitlementStep {
  fromYears: number;
  days: number;
}

export interface EntitlementRule {
  leaveType: LeaveType;
  label: string;
  steps: EntitlementStep[];
  /** The employee flag HR must set, when the type needs one. */
  eligibilityFlag?: 'paternityLeaveEligible' | 'soloParentLeaveEligible';
}

export const LEAVE_ENTITLEMENT_RULES: EntitlementRule[] = [
  { leaveType: LeaveType.VACATION, label: 'Vacation Leave', steps: [{ fromYears: 0, days: 0 }, { fromYears: 1, days: 10 }, { fromYears: 3, days: 15 }] },
  { leaveType: LeaveType.SICK, label: 'Sick Leave', steps: [{ fromYears: 0, days: 0 }, { fromYears: 1, days: 7 }] },
  { leaveType: LeaveType.BEREAVEMENT, label: 'Bereavement Leave', steps: [{ fromYears: 0, days: 0 }, { fromYears: 1, days: 5 }] },
  { leaveType: LeaveType.PATERNITY, label: 'Paternity Leave', steps: [{ fromYears: 0, days: 0 }, { fromYears: 1, days: 7 }], eligibilityFlag: 'paternityLeaveEligible' },
  { leaveType: LeaveType.SOLO_PARENT, label: 'Solo Parent Leave', steps: [{ fromYears: 0, days: 0 }, { fromYears: 1, days: 7 }], eligibilityFlag: 'soloParentLeaveEligible' },
];

export const AUTOMATIC_LEAVE_TYPES = new Set<LeaveType>(LEAVE_ENTITLEMENT_RULES.map((r) => r.leaveType));

export interface EntitlementResult {
  leaveType: LeaveType;
  label: string;
  completedYears: number;
  /** null when the type needs HR eligibility and the employee is not eligible. */
  eligible: boolean;
  days: number;
  /** Plain explanation of how the days were reached. */
  reason: string;
  /** The next step up, if any: the years at which it applies and its days. */
  next: EntitlementStep | null;
}

/** Days for one leave type at a number of completed years. */
export function entitlementFor(
  rule: EntitlementRule,
  completedYears: number,
  flags: { paternityLeaveEligible?: boolean; soloParentLeaveEligible?: boolean }
): EntitlementResult {
  const eligible = rule.eligibilityFlag ? Boolean(flags[rule.eligibilityFlag]) : true;
  const step = [...rule.steps].reverse().find((s) => completedYears >= s.fromYears) ?? rule.steps[0];
  const next = rule.steps.find((s) => s.fromYears > completedYears) ?? null;
  const yearsText = `${completedYears} completed year${completedYears === 1 ? '' : 's'}`;

  if (!eligible) {
    return {
      leaveType: rule.leaveType, label: rule.label, completedYears, eligible, days: 0, next: null,
      reason: `Not marked eligible by HR — ${rule.label} is granted only to employees HR has marked eligible.`,
    };
  }
  return {
    leaveType: rule.leaveType, label: rule.label, completedYears, eligible, days: step.days, next,
    reason: `${yearsText} of service → ${step.days} day${step.days === 1 ? '' : 's'}`,
  };
}
