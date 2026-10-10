/**
 * Which employees an organisation calendar entry (holiday, non-working day,
 * suspension) applies to.
 *
 * HR can mark units that are expected to work on an entry — Hospicio's example
 * is Pastoral Care / Homelife Services working through a holiday. Everyone in
 * those units keeps their normal schedule that day; every other unit observes
 * the entry. Units, not departments, because HSJ's organisation is recorded in
 * units (no departments are defined).
 *
 * Nothing here is a pay rule. It only decides whether "today is a holiday for
 * this person" is true, so schedules, Daily Monitoring and import review agree.
 */

export interface ScopedCalendarEntry {
  workingUnits?: Array<{ unitId: string }> | null;
}

/** True when the entry applies to someone in `unitId` (no unit → applies). */
export function calendarEntryAppliesToUnit(entry: ScopedCalendarEntry, unitId: string | null | undefined): boolean {
  if (!unitId) return true;
  return !(entry.workingUnits ?? []).some((w) => w.unitId === unitId);
}
