/**
 * Employment status, dates and length of service — one source of truth for the
 * profile, the directory, the onboarding wizard and the edit form.
 */

export type EmploymentState = "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "TERMINATED" | "RETIRED" | "AWOL" | "OTHERS";

/** The five endings HR can record. ACTIVE / ON_LEAVE mean still employed. */
export const ENDED_STATES: EmploymentState[] = ["AWOL", "RESIGNED", "RETIRED", "TERMINATED", "OTHERS"];

export const EMPLOYMENT_STATE_LABELS: Record<EmploymentState, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  AWOL: "AWOL",
  RESIGNED: "Resigned",
  RETIRED: "Retired",
  TERMINATED: "Terminated",
  OTHERS: "Others",
};

/** Options for the "why did the employment end" picker, in HR's order. */
export const ENDING_OPTIONS: Array<{ value: EmploymentState; label: string }> =
  ENDED_STATES.map((value) => ({ value, label: EMPLOYMENT_STATE_LABELS[value] }));

export const hasEnded = (state?: string | null): boolean =>
  !!state && (ENDED_STATES as string[]).includes(state);

/** Date-only parse: "2020-03-15" and ISO timestamps both land on the same day. */
function toDay(value?: string | Date | null): Date | null {
  if (!value) return null;
  const raw = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface EmploymentDuration {
  years: number;
  months: number;
  days: number;
  /** e.g. "6 Years, 6 Months, 13 Days" */
  text: string;
  /** True while the person is still employed (duration counted up to today). */
  ongoing: boolean;
}

/** Same day-of-month a number of months on, clamped to the month's length
 *  (31 Jan + 1 month = 29 Feb in a leap year, not 2 March). */
function addMonths(from: Date, count: number): Date {
  const target = new Date(from.getFullYear(), from.getMonth() + count, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return target;
}

/**
 * Calendar-correct length of service: whole months first (so every month counts
 * as itself, long or short), then the leftover days. Never total-days ÷ 365.
 *
 * 15 Mar 2020 → 20 Aug 2025 = 5 Years, 5 Months, 5 Days.
 */
export function employmentDuration(
  start?: string | Date | null,
  end?: string | Date | null
): EmploymentDuration | null {
  const from = toDay(start);
  if (!from) return null;
  const ongoing = !end;
  const to = toDay(end) ?? toDay(new Date());
  if (!to || to < from) return null;

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (addMonths(from, months) > to) months -= 1;
  const anchor = addMonths(from, months);
  const days = Math.round((to.getTime() - anchor.getTime()) / 86_400_000);

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const parts = [
    `${years} ${years === 1 ? "Year" : "Years"}`,
    `${restMonths} ${restMonths === 1 ? "Month" : "Months"}`,
    `${days} ${days === 1 ? "Day" : "Days"}`,
  ];
  return { years, months: restMonths, days, text: parts.join(", "), ongoing };
}

/** "March 15, 2020" — or a dash when there is no date to show. */
export function formatEmploymentDate(value?: string | Date | null): string {
  const d = toDay(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

/** An employee counts as a professional once a PRC licence number is recorded. */
export const isProfessional = (employee?: { prcLicenseNumber?: string | null } | null): boolean =>
  !!employee?.prcLicenseNumber && String(employee.prcLicenseNumber).trim() !== "";
