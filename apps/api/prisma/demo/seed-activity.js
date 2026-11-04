/**
 * Months of demo activity, so the hosted demo looks like a system that has been
 * in use since mid-2026 rather than one switched on yesterday.
 *
 *   • Weekly schedules for EVERY demo and team employee from 1 May 2026 (HR and
 *     Sister included), ending where a later schedule already starts.
 *   • Attendance for June, July, September and October 2026, imported month by
 *     month, with realistic tardiness, undertime, half days and absences. August
 *     is deliberately left EMPTY: it is filled by uploading the August timesheet
 *     through Attendance → Import, to show the import working.
 *   • Compliance: requirements an institution like Hospicio tracks (annual
 *     physical, police clearance, licences, food handler's certificates, BLS,
 *     orientations), with records in every state — valid, expiring soon,
 *     expired, waiting for review, missing.
 *   • Medical and psychological records, and completed and upcoming trainings.
 *
 * Who: only employees numbered DEV-… (the invented demo accounts) and TEAM-…
 * (the team's own HR accounts). Medical and psychological records are NEVER
 * added for TEAM-… accounts: those carry real people's names.
 *
 * Safe for a hosted database, like the rest of the demo seed:
 *   - Runs ONCE per database (a `system_settings` marker). Never deletes or
 *     changes an existing row; a day that already has attendance is left alone.
 *   - Every id is derived from a fixed key, and the randomness is seeded, so the
 *     data is the same on every database and a re-run after a failure creates
 *     only what is missing.
 *   - seed-demo.js calls it inside try/catch: a failure here never blocks a deploy.
 *
 * The attendance model (`simulateDay`) is exported so the August timesheet
 * generator produces the same people with the same habits.
 */
'use strict';

const crypto = require('crypto');
const { ROLE_PATTERNS, SHIFTS, WEEK, HR_UNIT_CODE } = require('./sample-schedules');

const MARKER_KEY = 'demo.activity_seeded_v1';
const SCHEDULE_FROM = '2026-05-01';
/** Months imported here. August is left for the upload. */
const MONTHS = ['2026-06', '2026-07', '2026-09', '2026-10'];
const CHUNK = 500;

// ── deterministic ids and randomness ─────────────────────────────────────────

/** A stable UUID for a key: the same row gets the same id on every database. */
function demoId(key) {
  const h = crypto.createHash('sha1').update(`hrisense-demo-activity:${key}`).digest('hex');
  const variant = (8 | (parseInt(h[16], 16) & 3)).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** A seeded random number generator (mulberry32) for a key. */
function rng(key) {
  let a = crypto.createHash('sha1').update(String(key)).digest().readUInt32LE(0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// ── dates and times ──────────────────────────────────────────────────────────

const ymd = (d) => d.toISOString().slice(0, 10);
const utcDate = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => ymd(new Date(utcDate(s).getTime() + n * 86_400_000));
const daysOfMonth = (month) => {
  const out = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) out.push(d);
  return out;
};
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** A Manila wall-clock time on a date → the instant (Manila is UTC+8, no DST). */
const manilaInstant = (date, min) => new Date(utcDate(date).getTime() + (min - 8 * 60) * 60_000);
const r2 = (n) => Math.round(n * 100) / 100;

// ── the attendance model ─────────────────────────────────────────────────────

/**
 * Each person's habits, fixed by their employee number: most are punctual, some
 * are often a little late, a few are late a lot.
 */
function habitsOf(employeeNumber) {
  const r = rng(`habits:${employeeNumber}`);
  const kind = r();
  const lateRate = kind < 0.6 ? 0.03 + r() * 0.04 : kind < 0.9 ? 0.1 + r() * 0.08 : 0.24 + r() * 0.12;
  return {
    lateRate,
    absentRate: 0.012 + r() * 0.03,
    undertimeRate: 0.02 + r() * 0.04,
    halfDayRate: 0.004 + r() * 0.01,
    overtimeRate: 0.03 + r() * 0.05,
  };
}

/**
 * One scheduled working day for one person: the punches, the hours, and what it
 * amounts to. `shifts` are the day's scheduled shifts as `{ start: 'HH:MM', end: 'HH:MM' }`.
 */
function simulateDay(employeeNumber, date, shifts) {
  const habits = habitsOf(employeeNumber);
  const r = rng(`day:${employeeNumber}:${date}`);
  const required = r2(shifts.reduce((t, s) => t + (toMin(s.end) - toMin(s.start)) / 60, 0));

  const roll = r();
  if (roll < habits.absentRate) {
    return { kind: 'ABSENT', sessions: [], required, worked: 0, overtime: 0, breakHours: 0, undertime: required, lateMinutes: 0, earlyMinutes: 0 };
  }
  const halfDay = roll < habits.absentRate + habits.halfDayRate;
  const late = r() < habits.lateRate;
  const leavesEarly = !halfDay && r() < habits.undertimeRate;
  const staysLate = !halfDay && !leavesEarly && r() < habits.overtimeRate;

  // Minutes late: mostly a few, sometimes half an hour, rarely an hour.
  const lateBy = late ? (r() < 0.7 ? between(r, 3, 15) : r() < 0.85 ? between(r, 16, 30) : between(r, 31, 60)) : 0;
  const earlyBy = leavesEarly ? between(r, 25, 120) : 0;

  // A half day is the first of two shifts, or the first half of a single shift.
  const worked = !halfDay
    ? shifts
    : shifts.length > 1
      ? shifts.slice(0, 1)
      : [{ start: shifts[0].start, end: toHhmm(toMin(shifts[0].start) + Math.round((toMin(shifts[0].end) - toMin(shifts[0].start)) / 2)) }];
  const sessions = worked.map((s, i) => {
    const first = i === 0;
    const last = i === worked.length - 1;
    let start = toMin(s.start);
    let end = toMin(s.end);
    // Arrival: before the shift (on time) or after it (late). After a lunch break,
    // people come back a few minutes early.
    start = first ? (late ? start + lateBy : start - between(r, 3, 22)) : start - between(r, 1, 5);
    // Leaving: a few minutes after; a one-shift half day ends at that shift's end.
    if (last && leavesEarly) end -= earlyBy;
    // Overtime never runs past midnight: the timesheet's times carry no date, so a
    // 00:30 clock-out would read as earlier than the clock-in.
    else if (last && staysLate) end = Math.min(end + between(r, 60, 150), 23 * 60 + 58);
    else if (!last) end += between(r, 0, 4); // out for lunch on the dot or just after
    else end += between(r, 0, 18);
    return { in: toHhmm(start), out: toHhmm(end) };
  });

  const span = sessions.reduce((t, s) => t + (toMin(s.out) - toMin(s.in)), 0) / 60;
  const scheduledEnd = toMin(worked[worked.length - 1].end);
  const overtime = staysLate ? r2((toMin(sessions[sessions.length - 1].out) - scheduledEnd) / 60) : 0;
  const workedHours = r2(span - overtime);
  const breakHours = sessions.length > 1
    ? r2(sessions.slice(1).reduce((t, s, i) => t + (toMin(s.in) - toMin(sessions[i].out)), 0) / 60)
    : 0;
  const undertime = r2(Math.max(0, required - workedHours));
  const kind = halfDay ? 'HALF_DAY' : late ? 'LATE' : 'PRESENT';
  return { kind, sessions, required, worked: workedHours, overtime, breakHours, undertime, lateMinutes: lateBy, earlyMinutes: earlyBy };
}

// ── schedules ────────────────────────────────────────────────────────────────

const OFFICE_WEEK = { days: Object.fromEntries(WEEK.slice(0, 5).map((d) => [d, ['OFFICE_AM', 'OFFICE_PM']])), careShift: false };

/** A person's weekly pattern: their role's, and the office week for HR (and any unlisted role). */
function patternOf(emp) {
  if (emp.unit?.code === HR_UNIT_CODE) return OFFICE_WEEK;
  return ROLE_PATTERNS[emp.jobRole?.code] ?? OFFICE_WEEK;
}

/** The scheduled shifts on a date, from the person's stored weekly schedules. */
function shiftsOn(schedules, date) {
  const target = utcDate(date);
  const active = schedules
    .filter((s) => s.effectiveFrom <= target && (!s.effectiveTo || s.effectiveTo > target))
    .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0];
  if (!active) return [];
  const day = active.days.find((d) => d.dayOfWeek === WEEK[(target.getUTCDay() + 6) % 7]);
  if (!day || day.status !== 'WORKING') return [];
  return day.shifts
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((x) => ({ start: x.shift.startTime.slice(0, 5), end: x.shift.endTime.slice(0, 5) }));
}

async function seedSchedules(prisma, employees, createdByUserId) {
  const shiftIds = {};
  for (const [name, times] of Object.entries(SHIFTS)) {
    const def = await prisma.shiftDefinition.findFirst({
      where: { ...times, isActive: true, isArchived: false },
      orderBy: { version: 'desc' },
    });
    if (!def) throw new Error(`no active shift ${times.startTime}-${times.endTime}`);
    shiftIds[name] = def.id;
  }
  const from = utcDate(SCHEDULE_FROM);
  let created = 0;
  for (const emp of employees) {
    const existing = await prisma.employeeWeeklySchedule.findMany({
      where: { employeeId: emp.id },
      select: { effectiveFrom: true },
      orderBy: { effectiveFrom: 'asc' },
    });
    if (existing.some((s) => s.effectiveFrom <= from)) continue; // already covered from May
    const pattern = patternOf(emp);
    await prisma.employeeWeeklySchedule.create({
      data: {
        id: demoId(`schedule:${emp.employeeNumber}`),
        employeeId: emp.id,
        effectiveFrom: from,
        // Ends where the person's next schedule starts (exclusive), as the app does.
        effectiveTo: existing[0]?.effectiveFrom ?? null,
        createdByUserId,
        days: {
          create: WEEK.map((day) => {
            const shifts = pattern.days[day] ?? [];
            return {
              dayOfWeek: day,
              status: shifts.length ? 'WORKING' : 'DAY_OFF',
              shifts: { create: shifts.map((name, i) => ({ shiftId: shiftIds[name], sequence: i + 1 })) },
            };
          }),
        },
      },
    });
    created++;
  }
  return created;
}

// ── attendance ───────────────────────────────────────────────────────────────

async function seedAttendance(prisma, employees, hrUserId) {
  const ids = employees.map((e) => e.id);
  const schedules = await prisma.employeeWeeklySchedule.findMany({
    where: { employeeId: { in: ids } },
    include: { days: { include: { shifts: { include: { shift: { select: { startTime: true, endTime: true } } } } } } },
  });
  const byEmployee = new Map(ids.map((id) => [id, []]));
  for (const s of schedules) byEmployee.get(s.employeeId).push(s);

  const holidays = new Set(
    (await prisma.organizationCalendarEntry.findMany({
      where: { type: { in: ['HOLIDAY', 'SPECIAL_NON_WORKING', 'ORGANIZATION_NON_WORKING'] }, status: { not: 'IGNORED' } },
      select: { date: true },
    })).map((h) => ymd(h.date))
  );

  const firstDay = utcDate(`${MONTHS[0]}-01`);
  const lastDay = utcDate(addDays(`${addDays(`${MONTHS[MONTHS.length - 1]}-28`, 4).slice(0, 7)}-01`, -1));
  const taken = new Set(
    (await prisma.attendanceRecord.findMany({
      where: { employeeId: { in: ids }, date: { gte: firstDay, lte: lastDay } },
      select: { employeeId: true, date: true },
    })).map((r) => `${r.employeeId}:${ymd(r.date)}`)
  );

  let records = 0;
  let logs = 0;
  for (const month of MONTHS) {
    const dates = daysOfMonth(month);
    const nextMonth = addDays(dates[dates.length - 1], 1);
    // The month's timesheet, as if imported on the first working day after it.
    const batchId = demoId(`import:${month}`);
    const uploadedAt = new Date(`${nextMonth}T01:${String(between(rng(`upload:${month}`), 5, 50)).padStart(2, '0')}:00Z`);
    const monthRecords = [];
    const monthLogs = [];

    for (const emp of employees) {
      const careShift = patternOf(emp).careShift;
      for (const date of dates) {
        if (taken.has(`${emp.id}:${date}`)) continue;
        const shifts = shiftsOn(byEmployee.get(emp.id), date);
        if (!shifts.length) continue; // rest day or no schedule
        if (holidays.has(date) && !careShift) continue; // office staff are off on holidays
        const day = simulateDay(emp.employeeNumber, date, shifts);
        const id = demoId(`attendance:${emp.employeeNumber}:${date}`);
        const dateValue = utcDate(date);

        if (day.kind === 'ABSENT') {
          monthRecords.push({
            id, employeeId: emp.id, date: dateValue, status: 'ABSENT',
            remarks: 'No punches on a scheduled working day and no approved leave.',
            sourceType: 'MANUAL', manuallyModifiedAt: uploadedAt, manuallyModifiedById: hrUserId, recordVersion: 1,
          });
          monthLogs.push({ id: demoId(`log:absent:${emp.employeeNumber}:${date}`), employeeId: emp.id, attendanceId: id, logType: 'ABSENT_UNEXCUSED', logDate: dateValue, notes: 'Absent without approved leave.' });
          continue;
        }

        const first = day.sessions[0];
        const last = day.sessions[day.sessions.length - 1];
        const remarks =
          day.kind === 'LATE' ? `Late by ${day.lateMinutes} minute${day.lateMinutes === 1 ? '' : 's'}.`
          : day.kind === 'HALF_DAY' ? 'Half day: worked the first part of the shift only.'
          : day.earlyMinutes ? `Left ${day.earlyMinutes} minutes before the end of the shift.`
          : null;
        monthRecords.push({
          id, employeeId: emp.id, date: dateValue, status: day.kind,
          timeIn: manilaInstant(date, toMin(first.in)),
          timeOut: manilaInstant(date, toMin(last.out)),
          hoursWorked: day.worked, overtimeHours: day.overtime,
          sessions: day.sessions,
          sourceHours: { required: day.required, break: day.breakHours, worked: day.worked, overtime: day.overtime, undertime: day.undertime },
          reviewFlags: day.sessions.length > 1 ? ['MULTIPLE_SESSIONS'] : [],
          remarks, sourceType: 'IMPORT', lastImportBatchId: batchId, recordVersion: 1,
        });
        if (day.kind === 'LATE') {
          monthLogs.push({ id: demoId(`log:late:${emp.employeeNumber}:${date}`), employeeId: emp.id, attendanceId: id, logType: 'LATE', logDate: dateValue, minutesLate: day.lateMinutes, notes: `First punch ${first.in}.` });
        }
        if (day.earlyMinutes) {
          monthLogs.push({ id: demoId(`log:undertime:${emp.employeeNumber}:${date}`), employeeId: emp.id, attendanceId: id, logType: 'UNDERTIME', logDate: dateValue, notes: `Left at ${last.out}, ${day.earlyMinutes} minutes early.` });
        }
      }
    }

    const imported = monthRecords.filter((r) => r.sourceType === 'IMPORT').length;
    await prisma.attendanceImportBatch.createMany({
      skipDuplicates: true,
      data: [{
        id: batchId,
        fileHash: crypto.createHash('sha256').update(`hrisense-demo-timesheet:${month}`).digest('hex'),
        originalFilename: `TIMESHEET_REPORT_${month.replace('-', '_')}.xls`,
        fileSizeBytes: 150_000 + between(rng(`size:${month}`), 0, 60_000),
        uploadedByUserId: hrUserId,
        uploadedAt,
        status: 'COMPLETED',
        detectedPeriodStart: utcDate(dates[0]),
        detectedPeriodEnd: utcDate(dates[dates.length - 1]),
        totalSourceRows: employees.length * dates.length,
        countNew: imported,
        countApplied: imported,
        countSkipped: employees.length * dates.length - imported,
        confirmedByUserId: hrUserId,
        confirmedAt: new Date(uploadedAt.getTime() + 14 * 60_000),
        completedAt: new Date(uploadedAt.getTime() + 15 * 60_000),
      }],
    });
    for (let i = 0; i < monthRecords.length; i += CHUNK) {
      records += (await prisma.attendanceRecord.createMany({ data: monthRecords.slice(i, i + CHUNK), skipDuplicates: true })).count;
    }
    for (let i = 0; i < monthLogs.length; i += CHUNK) {
      logs += (await prisma.attendanceLog.createMany({ data: monthLogs.slice(i, i + CHUNK), skipDuplicates: true })).count;
    }
  }
  return { records, logs };
}

// ── compliance, medical, psychological, training ─────────────────────────────

/** Requirements, with who they apply to (ALL, units by code, or job roles by code). */
const REQUIREMENTS = [
  { key: 'ape', title: 'Annual Physical Examination', category: 'MEDICAL', tracksExpiry: true, reminderDays: 30, scope: { all: true },
    description: 'A yearly medical examination confirming fitness for work.' },
  { key: 'psy', title: 'Psychological Fitness Assessment', category: 'PSYCHOLOGICAL', tracksExpiry: true, reminderDays: 30, scope: { units: ['SOC', 'PCH'] },
    description: 'A yearly assessment for staff who work directly with children, youth and the elderly.' },
  { key: 'police', title: 'Police Clearance', category: 'DOCUMENT', tracksExpiry: true, reminderDays: 30, validMonths: 12, scope: { all: true },
    description: 'A valid police clearance on file for every employee.' },
  { key: 'prc', title: 'PRC Professional License', category: 'PROFESSIONAL_LICENSE', tracksExpiry: true, reminderDays: 60, validMonths: 36,
    scope: { roles: ['SOCIAL_WORKER', 'HEAD_SSD', 'PSYCHOLOGIST', 'PT_PSYCHOLOGIST', 'PT_STAFF', 'PT_COORDINATOR', 'ECCD_TEACHER'] },
    description: 'A current Professional Regulation Commission licence for licensed professions.' },
  { key: 'food', title: "Food Handler's Health Certificate", category: 'CERTIFICATION', tracksExpiry: true, reminderDays: 30, validMonths: 12,
    scope: { roles: ['KITCHEN_SUPERVISOR', 'KITCHEN_STAFF', 'CANTEEN_STAFF', 'BAKERY_STAFF'] },
    description: 'Required of everyone who prepares or serves food.' },
  { key: 'bls', title: 'Basic Life Support (BLS) Certification', category: 'CERTIFICATION', tracksExpiry: true, reminderDays: 60, validMonths: 24,
    scope: { units: ['HLT', 'PCH'] }, description: 'For clinic and homelife staff, renewed every two years.' },
  { key: 'cpp', title: 'Child Protection Policy Orientation', category: 'TRAINING', tracksExpiry: true, reminderDays: 30, validMonths: 12, scope: { all: true },
    description: "The yearly orientation on Hospicio's child protection policy." },
  { key: 'dpa', title: 'Data Privacy Act Orientation', category: 'TRAINING', tracksExpiry: false, reminderDays: null, scope: { all: true },
    description: 'Republic Act 10173: handling personal and sensitive information.' },
  { key: 'fire', title: 'Fire Safety and Earthquake Drill', category: 'TRAINING', tracksExpiry: true, reminderDays: 30, validMonths: 12, scope: { all: true },
    description: 'The yearly evacuation and fire safety drill.' },
];

/** Trainings: completed ones produce compliance records; upcoming ones only invitations. */
const TRAININGS = [
  { key: 'cpp-2026', req: 'cpp', title: 'Child Protection Policy Orientation 2026', type: 'ORIENTATION', date: '2026-06-18', start: '08:30', end: '12:00', hours: 3.5,
    provider: 'Social Services Department', venue: 'Main Hall', status: 'COMPLETED' },
  { key: 'dpa-2026', req: 'dpa', title: 'Data Privacy Act Orientation', type: 'SEMINAR', date: '2026-07-15', start: '13:30', end: '16:30', hours: 3,
    provider: 'Human Resource Department', venue: 'Conference Room', status: 'COMPLETED' },
  { key: 'bls-2026', req: 'bls', title: 'Basic Life Support (BLS) Certification Course', type: 'TRAINING', date: '2026-07-22', end_date: '2026-07-23', start: '08:00', end: '17:00', hours: 16,
    provider: 'Accredited BLS training provider', venue: 'Clinic Training Room', status: 'COMPLETED' },
  { key: 'fire-2026', req: 'fire', title: 'Fire Safety and Earthquake Drill', type: 'TRAINING', date: '2026-09-24', start: '09:00', end: '11:00', hours: 2,
    provider: 'General Support Services with the local fire station', venue: 'Whole compound', status: 'COMPLETED' },
  { key: 'ipc-2026', req: null, title: 'Infection Prevention and Control Refresher', type: 'WORKSHOP', date: '2026-11-19', start: '13:00', end: '17:00', hours: 4,
    provider: 'Health Services', venue: 'Clinic Training Room', status: 'SCHEDULED', scope: { units: ['HLT', 'PCH'] } },
  { key: 'mhfa-2026', req: null, title: 'Mental Health First Aid Workshop', type: 'WORKSHOP', date: '2026-12-03', start: '08:30', end: '16:30', hours: 7,
    provider: 'Social Services Department', venue: 'Main Hall', status: 'SCHEDULED', scope: { units: ['SOC', 'PCH'] } },
];

const applies = (scope, emp) =>
  !!scope.all ||
  (scope.units ?? []).includes(emp.unit?.code) ||
  (scope.roles ?? []).includes(emp.jobRole?.code);

const addMonths = (date, n) => {
  const d = utcDate(date);
  d.setUTCMonth(d.getUTCMonth() + n);
  return ymd(d);
};

/**
 * Where a record stands, chosen per person and requirement: most are in order,
 * some expire soon, a few have expired, are waiting for review, or are missing.
 * Returns the completion date for that state, or null for "missing".
 */
function recordState(key, validMonths) {
  const r = rng(`state:${key}`);
  const roll = r();
  const months = validMonths ?? 12;
  // "Today" for the demo is early November 2026.
  if (roll < 0.76) return { state: 'VALID', done: addDays('2026-02-01', between(r, 0, 240)) };
  if (roll < 0.84) return { state: 'SOON', done: addDays(addMonths('2026-11-08', -months), between(r, 0, 22)) };
  if (roll < 0.9) return { state: 'EXPIRED', done: addDays(addMonths('2026-10-25', -months), -between(r, 0, 90)) };
  if (roll < 0.95) return { state: 'PENDING', done: addDays('2026-10-05', between(r, 0, 25)) };
  return { state: 'MISSING', done: null };
}

async function seedCompliance(prisma, employees, people) {
  const { hrUserId, sisterUserId, userIdOf } = people;
  const units = new Map((await prisma.unit.findMany({ select: { id: true, code: true } })).map((u) => [u.code, u.id]));
  const roles = new Map((await prisma.jobRole.findMany({ select: { id: true, code: true } })).map((j) => [j.code, j.id]));

  // Requirements: reuse one with the same title rather than adding a twin.
  const reqId = {};
  let requirementsCreated = 0;
  for (const q of REQUIREMENTS) {
    const existing = await prisma.complianceRequirement.findFirst({ where: { title: q.title, deletedAt: null }, select: { id: true } });
    if (existing) {
      reqId[q.key] = existing.id;
      continue;
    }
    const id = demoId(`requirement:${q.key}`);
    const scopes = q.scope.all
      ? [{ scopeType: 'ALL' }]
      : [
          ...(q.scope.units ?? []).filter((c) => units.has(c)).map((c) => ({ scopeType: 'UNIT', targetUnitId: units.get(c) })),
          ...(q.scope.roles ?? []).filter((c) => roles.has(c)).map((c) => ({ scopeType: 'JOB_ROLE', targetJobRoleId: roles.get(c) })),
        ];
    await prisma.complianceRequirement.create({
      data: {
        id, title: q.title, description: q.description, category: q.category,
        tracksExpiry: q.tracksExpiry, reminderDays: q.reminderDays, lifecycle: 'ACTIVE', createdById: hrUserId,
        createdAt: new Date('2026-05-04T01:30:00Z'),
        scopes: { create: scopes },
      },
    });
    reqId[q.key] = id;
    requirementsCreated++;
  }

  /**
   * Who added and who reviewed a person's record. HR's own records are added by
   * themselves and accepted automatically (the HR rule); everyone else's by HR.
   */
  const AUTO = "Accepted automatically: HR's own record, with proof attached.";
  const handledBy = (emp, state) => {
    const own = emp.unit?.code === HR_UNIT_CODE && userIdOf.get(emp.id);
    const createdById = own ? userIdOf.get(emp.id) : hrUserId;
    if (state === 'PENDING') return { createdById, reviewStatus: 'PENDING_REVIEW', reviewedById: null, reviewReason: null };
    return own
      ? { createdById, reviewStatus: 'ACCEPTED', reviewedById: createdById, reviewReason: AUTO }
      : { createdById, reviewStatus: 'ACCEPTED', reviewedById: hrUserId, reviewReason: null };
  };
  const reviewedAt = (done) => new Date(`${addDays(done, 2)}T02:00:00Z`);

  // ── document, licence and certificate records ──────────────────────────────
  const docs = [];
  const docRequirements = REQUIREMENTS.filter((q) => ['DOCUMENT', 'PROFESSIONAL_LICENSE', 'CERTIFICATION'].includes(q.category) && q.key !== 'bls');
  for (const q of docRequirements) {
    for (const emp of employees.filter((e) => applies(q.scope, e))) {
      const key = `${q.key}:${emp.employeeNumber}`;
      const { state, done } = recordState(key, q.validMonths);
      if (!done) continue;
      const r = rng(`ref:${key}`);
      const prefix = { police: 'PC', prc: 'PRC', food: 'FHC' }[q.key];
      docs.push({
        id: demoId(`compliance:${key}`),
        employeeId: emp.id,
        requirementId: reqId[q.key],
        recordTitle: q.title,
        referenceNumber: `${prefix}-${done.slice(0, 4)}-${String(between(r, 100000, 999999))}`,
        completedAt: utcDate(done),
        expiresAt: q.tracksExpiry ? utcDate(addMonths(done, q.validMonths ?? 12)) : null,
        createdAt: new Date(`${done}T03:00:00Z`),
        ...handledBy(emp, state),
        ...(state !== 'PENDING' ? { reviewedAt: reviewedAt(done) } : {}),
      });
    }
  }

  // ── medical and psychological records (never for TEAM-… accounts) ──────────
  const medical = [];
  const psych = [];
  for (const emp of employees.filter((e) => !e.real)) {
    const mKey = `ape:${emp.employeeNumber}`;
    const m = recordState(mKey, 12);
    if (m.done) {
      const r = rng(`med:${mKey}`);
      medical.push({
        id: demoId(`medical:${mKey}`),
        employeeId: emp.id,
        requirementId: reqId.ape,
        examType: 'ANNUAL',
        examDate: utcDate(m.done),
        examinedBy: r() < 0.6 ? 'Hospicio clinic physician' : 'Partner diagnostic clinic',
        hrNotes: r() < 0.85 ? 'Fit to work.' : 'Fit to work. Advised a follow-up check of blood pressure.',
        expiresAt: utcDate(addMonths(m.done, 12)),
        createdAt: new Date(`${m.done}T05:00:00Z`),
        ...handledBy(emp, m.state),
        ...(m.state !== 'PENDING' ? { reviewedAt: reviewedAt(m.done) } : {}),
      });
    }
    if (applies(REQUIREMENTS.find((q) => q.key === 'psy').scope, emp)) {
      const pKey = `psy:${emp.employeeNumber}`;
      const p = recordState(pKey, 12);
      if (p.done) {
        psych.push({
          id: demoId(`psych:${pKey}`),
          employeeId: emp.id,
          requirementId: reqId.psy,
          assessmentType: 'ANNUAL',
          assessmentDate: utcDate(p.done),
          conductedBy: 'Contracted psychologist',
          employeeVisibleSummary: 'Fit for duty. No concerns noted.',
          expiresAt: utcDate(addMonths(p.done, 12)),
          createdAt: new Date(`${p.done}T05:00:00Z`),
          ...handledBy(emp, p.state),
          ...(p.state !== 'PENDING' ? { reviewedAt: reviewedAt(p.done) } : {}),
        });
      }
    }
  }

  // ── trainings ──────────────────────────────────────────────────────────────
  const activities = [];
  const participants = [];
  const generated = [];
  for (const t of TRAININGS) {
    const existing = await prisma.trainingActivity.findFirst({ where: { title: t.title, deletedAt: null }, select: { id: true } });
    if (existing) continue;
    const id = demoId(`training:${t.key}`);
    const q = t.req ? REQUIREMENTS.find((x) => x.key === t.req) : null;
    const scope = t.scope ?? q.scope;
    activities.push({
      id, title: t.title, type: t.type, provider: t.provider, venue: t.venue,
      description: q ? `Counts toward the "${q.title}" requirement.` : null,
      startDate: utcDate(t.date), endDate: utcDate(t.end_date ?? t.date), startTime: t.start, endTime: t.end,
      hoursCredit: t.hours, status: t.status, complianceRequirementId: q ? reqId[q.key] : null, createdById: hrUserId,
      createdAt: new Date(`${addDays(t.date, -21)}T02:00:00Z`),
    });
    for (const emp of employees.filter((e) => applies(scope, e))) {
      const pid = demoId(`participant:${t.key}:${emp.employeeNumber}`);
      if (t.status !== 'COMPLETED') {
        participants.push({ id: pid, trainingActivityId: id, employeeId: emp.id, participationStatus: 'ASSIGNED', assignedAt: new Date(`${addDays(t.date, -14)}T02:00:00Z`) });
        continue;
      }
      const roll = rng(`attend:${t.key}:${emp.employeeNumber}`)();
      const status = roll < 0.88 ? 'COMPLETED' : roll < 0.94 ? 'EXCUSED' : 'DID_NOT_ATTEND';
      const done = t.end_date ?? t.date;
      const validUntil = q?.tracksExpiry ? utcDate(addMonths(done, q.validMonths ?? 12)) : null;
      const recordId = status === 'COMPLETED' && q ? demoId(`compliance:training:${t.key}:${emp.employeeNumber}`) : null;
      participants.push({
        id: pid, trainingActivityId: id, employeeId: emp.id, participationStatus: status,
        assignedAt: new Date(`${addDays(t.date, -14)}T02:00:00Z`),
        completedAt: status === 'COMPLETED' ? utcDate(done) : null,
        validUntil: status === 'COMPLETED' ? validUntil : null,
        notes: status === 'EXCUSED' ? 'Excused: on duty during the session.' : null,
        complianceRecordId: recordId,
      });
      if (recordId) {
        // What the app writes when a training is marked completed.
        generated.push({
          id: recordId, employeeId: emp.id, requirementId: reqId[q.key], recordTitle: t.title,
          referenceNumber: `TRN-${id.slice(0, 8).toUpperCase()}`,
          completedAt: utcDate(done), expiresAt: validUntil,
          notes: `Auto-generated from completed training activity "${t.title}".`,
          reviewStatus: 'ACCEPTED', createdById: hrUserId, generatedFromTrainingParticipantId: pid,
          createdAt: new Date(`${addDays(done, 1)}T02:00:00Z`),
        });
      }
    }
  }

  const write = async (delegate, rows) => {
    let n = 0;
    for (let i = 0; i < rows.length; i += CHUNK) n += (await delegate.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true })).count;
    return n;
  };
  // Order matters: participants point at their generated compliance record, and
  // that record points back at the participant.
  const created = {
    requirements: requirementsCreated,
    complianceRecords: await write(prisma.employeeComplianceRecord, docs),
    medicalRecords: await write(prisma.medicalRecord, medical),
    psychologicalRecords: await write(prisma.psychologicalRecord, psych),
    trainings: await write(prisma.trainingActivity, activities),
  };
  created.participants = await write(prisma.trainingParticipant, participants.map(({ complianceRecordId, ...p }) => p));
  created.trainingRecords = await write(prisma.employeeComplianceRecord, generated);
  for (const p of participants.filter((x) => x.complianceRecordId)) {
    await prisma.trainingParticipant.updateMany({ where: { id: p.id, complianceRecordId: null }, data: { complianceRecordId: p.complianceRecordId } });
  }
  return created;
}

// ── entry point ──────────────────────────────────────────────────────────────

/** The demo and team employees the activity is for. */
async function demoEmployees(prisma) {
  const rows = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      employmentState: { in: ['ACTIVE', 'ON_LEAVE'] },
      OR: [{ employeeNumber: { startsWith: 'DEV-' } }, { employeeNumber: { startsWith: 'TEAM-' } }],
    },
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true, biometricCode: true,
      unit: { select: { code: true } }, jobRole: { select: { code: true } }, user: { select: { id: true } },
    },
    orderBy: { employeeNumber: 'asc' },
  });
  return rows.map((e) => ({ ...e, real: e.employeeNumber.startsWith('TEAM-') }));
}

/** Gives a timekeeping code to any demo or team employee still without one. */
async function ensureCodes(prisma, employees) {
  let next = 960;
  let set = 0;
  for (const emp of employees.filter((e) => !e.biometricCode)) {
    while (await prisma.employee.findFirst({ where: { biometricCode: String(next) }, select: { id: true } })) next++;
    await prisma.employee.update({ where: { id: emp.id }, data: { biometricCode: String(next) } });
    emp.biometricCode = String(next++);
    set++;
  }
  return set;
}

async function seedDemoActivity({ prisma }) {
  if (await prisma.systemSetting.findUnique({ where: { key: MARKER_KEY } })) {
    console.log('\nDemo activity: already done on this database (left as it is).');
    return;
  }
  const employees = await demoEmployees(prisma);
  if (!employees.length) {
    console.log('\nDemo activity: skipped (no demo employees).');
    return;
  }
  const userIdOf = new Map(employees.filter((e) => e.user).map((e) => [e.id, e.user.id]));
  const hrOfficer = employees.find((e) => e.jobRole?.code === 'HR_OFFICER' && e.employeeNumber.startsWith('DEV-') && e.user)
    ?? employees.find((e) => e.jobRole?.code === 'HR_OFFICER' && e.user);
  const sister = employees.find((e) => e.jobRole?.code === 'SISTER' && e.user);
  if (!hrOfficer) {
    console.log('\nDemo activity: skipped (no HR Officer account to record it under).');
    return;
  }
  const people = { hrUserId: hrOfficer.user.id, sisterUserId: sister?.user.id ?? hrOfficer.user.id, userIdOf };

  const codes = await ensureCodes(prisma, employees);
  const schedules = await seedSchedules(prisma, employees, people.hrUserId);
  const attendance = await seedAttendance(prisma, employees, people.hrUserId);
  const compliance = await seedCompliance(prisma, employees, people);

  await prisma.systemSetting.create({
    data: {
      key: MARKER_KEY,
      value: new Date().toISOString(),
      description: 'Months of demo activity (schedules, attendance, compliance, training) were added by prisma/demo/seed-activity.js.',
    },
  });

  console.log('\nDemo activity');
  console.log(`  Employees covered:           ${employees.length}`);
  console.log(`  Timekeeping codes set:       ${codes}`);
  console.log(`  Weekly schedules (from May): ${schedules}`);
  console.log(`  Attendance records:          ${attendance.records}  (August left for the upload)`);
  console.log(`  Late / undertime / absence logs: ${attendance.logs}`);
  console.log(`  Compliance requirements:     ${compliance.requirements}`);
  console.log(`  Compliance records:          ${compliance.complianceRecords + compliance.trainingRecords}`);
  console.log(`  Medical / psychological:     ${compliance.medicalRecords} / ${compliance.psychologicalRecords}`);
  console.log(`  Trainings / participants:    ${compliance.trainings} / ${compliance.participants}`);
}

module.exports = { seedDemoActivity, simulateDay, habitsOf, shiftsOn, patternOf, demoEmployees, demoId, MARKER_KEY };

// Run on its own: node prisma/demo/seed-activity.js
if (require.main === module) {
  require('dotenv').config();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  seedDemoActivity({ prisma })
    .catch((err) => {
      console.error(`\nDemo activity failed: ${err.message || err}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
