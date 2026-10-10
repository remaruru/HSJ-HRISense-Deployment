/**
 * Leave types — one set of labels for every leave screen, and the grouping of
 * Hospicio's Leave Application Form ("Details of Leave"). Entitlements are not
 * defined here: the completed-years rules live on the server
 * (apps/api/src/lib/leave-entitlement.ts) and other types have only the credits
 * HR enters.
 */

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation Leave',
  SICK: 'Sick Leave',
  EMERGENCY: 'Emergency Leave',
  BEREAVEMENT: 'Bereavement Leave',
  PATERNITY: 'Paternity Leave',
  MATERNITY: 'Maternity Leave',
  LEAVE_WITHOUT_PAY: 'Leave Without Pay',
  SOLO_PARENT: 'Solo Parent Leave',
  OFFSET: 'Offset',
  STUDY: 'Study Leave',
  REHABILITATION: 'Rehabilitation Leave',
  SPECIAL_PRIVILEGE: 'Special Privilege Leave',
  FORCED: 'Forced Leave',
  OTHER: 'Other Leave',
};

export const leaveTypeLabel = (type?: string | null) => (type ? LEAVE_TYPE_LABELS[type] ?? type : '—');

/**
 * The paper form's "Details of Leave", in its order. Sick and Emergency share
 * the form's SL/EL line but keep their own balances, as HR has set them up.
 * Types HRISense already had that the form does not name sit under "Others".
 */
export const HOSPICIO_LEAVE_GROUPS: Array<{ label: string; types: string[] }> = [
  { label: 'Vacation Leave (VL)', types: ['VACATION'] },
  { label: 'Sick / Emergency Leave (SL/EL)', types: ['SICK', 'EMERGENCY'] },
  { label: 'Bereavement Leave (BL)', types: ['BEREAVEMENT'] },
  { label: 'Paternity / Maternity Leave', types: ['PATERNITY', 'MATERNITY'] },
  { label: 'Leave Without Pay', types: ['LEAVE_WITHOUT_PAY'] },
  {
    label: 'Others / Offset / Solo Parent',
    types: ['SOLO_PARENT', 'OFFSET', 'STUDY', 'REHABILITATION', 'SPECIAL_PRIVILEGE', 'FORCED', 'OTHER'],
  },
];

/** Leave that uses no leave credits at all. */
export const NO_CREDIT_LEAVE_TYPES = new Set(['LEAVE_WITHOUT_PAY']);

/** Inclusive calendar days — the server's rule until Hospicio confirms another. */
export function leaveCalendarDays(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const toDay = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const s = toDay(start);
  const e = toDay(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** A leave request's status in the words the employee and reviewers use. */
export function leaveStage(r: any): { label: string; tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' } {
  switch (r?.status) {
    case 'PENDING':
      // No head in the chain → the request went straight to HR.
      return { label: r.employee && !r.employee.immediateSupervisorId ? 'Waiting for HR' : 'Waiting for head', tone: 'warning' };
    case 'FOR_REVIEW':
      return { label: r.proposedStartDate ? 'Change proposed — with HR' : 'Endorsed — with HR', tone: 'info' };
    case 'APPROVED':
      return { label: r.originalStartDate ? 'Approved with changes' : 'Approved', tone: 'success' };
    case 'REJECTED':
      return { label: 'Declined', tone: 'danger' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: String(r?.status ?? ''), tone: 'neutral' };
  }
}

export const daysText = (n?: number | null) => (n === null || n === undefined ? '—' : `${n} day${n === 1 ? '' : 's'}`);
