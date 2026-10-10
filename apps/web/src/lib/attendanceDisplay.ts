/**
 * How a person and a day's schedule are written on attendance screens — one
 * place, so every panel says the same thing.
 */

/** "Dela Cruz, Juan" — without a stray comma when a part is missing. */
export function personName(e?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!e) return 'Unknown employee';
  return [e.lastName?.trim(), e.firstName?.trim()].filter(Boolean).join(', ') || 'Unnamed employee';
}

/** "08:00" → "8:00 AM". Anything unreadable is returned as given. */
export function to12h(hhmm?: string | null): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

export type ScheduleKind = 'WORKING' | 'DAY_OFF' | 'UNCONFIGURED' | 'NONE';

/**
 * A day's schedule in words. Accepts both shapes the API returns: the resolved
 * `effectiveEmployeeSchedule` (shifts[]) and the coverage day (status +
 * startTime/endTime). Internal source codes are never shown.
 */
export function scheduleSummary(sched: any): { kind: ScheduleKind; label: string; times: string } {
  if (!sched) return { kind: 'NONE', label: 'No schedule assigned', times: '' };
  const status: string = sched.status ?? sched.type ?? '';
  const working = sched.isWorkingDay === true || status === 'WORKING';
  if (working) {
    const shifts: Array<{ startTime?: string; endTime?: string }> =
      Array.isArray(sched.shifts) && sched.shifts.length ? sched.shifts : sched.startTime || sched.endTime ? [{ startTime: sched.startTime, endTime: sched.endTime }] : [];
    const times = shifts
      .filter((s) => s.startTime || s.endTime)
      .map((s) => `${to12h(s.startTime) || '?'} – ${to12h(s.endTime) || '?'}`)
      .join(', ');
    return { kind: 'WORKING', label: times ? 'Working' : 'Working (no shift times)', times };
  }
  if (status === 'UNCONFIGURED') return { kind: 'UNCONFIGURED', label: 'Schedule not set up', times: '' };
  if (status === 'NO_SCHEDULE') return { kind: 'NONE', label: 'No schedule assigned', times: '' };
  return { kind: 'DAY_OFF', label: 'Day off', times: '' };
}
