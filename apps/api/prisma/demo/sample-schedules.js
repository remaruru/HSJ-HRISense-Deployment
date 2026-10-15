/**
 * Sample weekly schedules and timekeeping codes for the hosted demo.
 *
 * Gives every active employee outside the HR department a weekly schedule (the
 * canonical `EmployeeWeeklySchedule` system) starting 1 September 2026, based on
 * their job role: office staff work the split office day Monday to Friday, care
 * and support staff work 8-hour shifts six days a week with a rest day that
 * differs between roles. It also gives a biometric (timekeeping) code to the
 * demo and team employees that have none, so an attendance file can match them.
 *
 * Runs ONCE per database. A `system_settings` marker records the run, so a later
 * deploy never re-creates a schedule HR has since changed or removed. Even on
 * that one run, an employee who already has any weekly schedule, and a code that
 * is already in use, are left alone. Called by seed-demo.js.
 */
'use strict';

const MARKER_KEY = 'demo.sample_schedules_seeded';
const EFFECTIVE_FROM = '2026-09-01';
const HR_UNIT_CODE = 'HRD';

const WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/** The shift definitions used, found by their times (names carry typographic dashes). */
const SHIFTS = {
  OFFICE_AM: { startTime: '08:00:00', endTime: '12:00:00' },
  OFFICE_PM: { startTime: '13:00:00', endTime: '18:00:00' },
  PART_TIME_AM: { startTime: '09:00:00', endTime: '12:00:00' },
  MORNING: { startTime: '06:00:00', endTime: '14:00:00' },
  AFTERNOON: { startTime: '14:00:00', endTime: '22:00:00' },
};

/**
 * A pattern: which weekdays are worked, with which shifts. `careShift` marks
 * round-the-clock services that also work holidays.
 */
const office = (days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) => ({
  days: Object.fromEntries(days.map((d) => [d, ['OFFICE_AM', 'OFFICE_PM']])),
  careShift: false,
});
const shift = (name, restDay) => ({
  days: Object.fromEntries(WEEK.filter((d) => d !== restDay).map((d) => [d, [name]])),
  careShift: true,
});
const partTime = (days) => ({
  days: Object.fromEntries(days.map((d) => [d, ['PART_TIME_AM']])),
  careShift: false,
});

/** Job role code → pattern. Roles not listed (or added later) get the office week. */
const ROLE_PATTERNS = {
  // Administrative and finance
  ADMIN_SEC: office(),
  RECEPTIONIST: office(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  ASST_ADMIN: office(),
  ACCOUNTING_STAFF: office(),
  LIAISON_OFFICER: office(),
  PMO_STAFF: office(),
  STOCKROOM_STAFF: office(),
  // Social services
  SOCIAL_WORKER: office(),
  PSYCHOLOGIST: office(),
  HEAD_SSD: office(),
  ECCD_TEACHER: office(),
  PT_PSYCHOLOGIST: partTime(['MONDAY', 'WEDNESDAY', 'FRIDAY']),
  // Health
  CLINIC_STAFF: shift('MORNING', 'SUNDAY'),
  PT_COORDINATOR: office(),
  PT_STAFF: office(),
  // Auxiliary
  BAKERY_STAFF: shift('MORNING', 'WEDNESDAY'),
  CANTEEN_STAFF: shift('MORNING', 'SUNDAY'),
  DORMITORY_STAFF: shift('AFTERNOON', 'TUESDAY'),
  IGP_COORDINATOR: office(),
  // General services
  KITCHEN_SUPERVISOR: shift('MORNING', 'SUNDAY'),
  KITCHEN_STAFF: shift('MORNING', 'THURSDAY'),
  JANITORIAL_SUPERVISOR: office(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  JANITORIAL_STAFF: shift('MORNING', 'FRIDAY'),
  LAUNDRY_STAFF: shift('MORNING', 'SATURDAY'),
  MAINTENANCE_SUPERVISOR: office(),
  MAINTENANCE_STAFF: shift('MORNING', 'SUNDAY'),
  DRIVER: office(),
  // Pastoral care and homelife
  HEAD_PCH: office(),
  CIP_COORDINATOR: office(),
  CY_COORDINATOR: office(),
  OP_COORDINATOR: office(),
  PSN_COORDINATOR: office(),
  PRE_SCHOOL_STAFF: office(),
  CHAPEL_STAFF: shift('MORNING', 'MONDAY'),
  RENDU_A_STAFF: shift('MORNING', 'MONDAY'),
  RENDU_B_STAFF: shift('AFTERNOON', 'TUESDAY'),
  RENDU_C_STAFF: shift('MORNING', 'WEDNESDAY'),
  SANCTUARY_CENTER_STAFF: shift('AFTERNOON', 'THURSDAY'),
  SIGLIV_BOYS_STAFF: shift('MORNING', 'FRIDAY'),
  ST_JOSEPH_STAFF: shift('AFTERNOON', 'SATURDAY'),
  ST_MARY_STAFF: shift('MORNING', 'SUNDAY'),
  ST_VINCENT_STAFF: shift('AFTERNOON', 'MONDAY'),
  STA_LUISA_STAFF: shift('MORNING', 'TUESDAY'),
  TAHAN_CENTER_STAFF: shift('AFTERNOON', 'WEDNESDAY'),
};

/** Timekeeping codes for the demo and team employees that have none (employee no. → code). */
const MISSING_CODES = {
  'DEV-HRD-003': '946', // Sister
  'DEV-SOC-002': '947', // Social Workers
  'DEV-SOC-012': '948', // ECCD Teacher
  'DEV-GSS-025': '949', // Maintenance Supervisor
  'TEAM-HRD-001': '950',
  'TEAM-HRD-002': '951',
  'TEAM-HRD-003': '952',
};

const patternFor = (roleCode) => ROLE_PATTERNS[roleCode] ?? office();

async function seedSampleSchedules({ prisma }) {
  if (await prisma.systemSetting.findUnique({ where: { key: MARKER_KEY } })) {
    console.log('\nSample schedules: already done on this database (left as they are).');
    return;
  }

  // ── timekeeping codes ───────────────────────────────────────────────────
  let codesSet = 0;
  for (const [employeeNumber, code] of Object.entries(MISSING_CODES)) {
    const emp = await prisma.employee.findUnique({ where: { employeeNumber }, select: { id: true, biometricCode: true } });
    if (!emp || emp.biometricCode) continue;
    if (await prisma.employee.findFirst({ where: { biometricCode: code } })) continue;
    await prisma.employee.update({ where: { id: emp.id }, data: { biometricCode: code } });
    codesSet++;
  }

  // ── weekly schedules ────────────────────────────────────────────────────
  const shiftIds = {};
  for (const [name, times] of Object.entries(SHIFTS)) {
    const def = await prisma.shiftDefinition.findFirst({
      where: { ...times, isActive: true, isArchived: false },
      orderBy: { version: 'desc' },
    });
    if (!def) {
      console.warn(`\nSample schedules: skipped (no active shift ${times.startTime}-${times.endTime}).`);
      return;
    }
    shiftIds[name] = def.id;
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, employmentState: { in: ['ACTIVE', 'ON_LEAVE'] }, unit: { code: { not: HR_UNIT_CODE } } },
    select: { id: true, employeeNumber: true, jobRole: { select: { code: true } }, _count: { select: { weeklySchedules: true } } },
  });

  let created = 0;
  let kept = 0;
  for (const emp of employees) {
    if (emp._count.weeklySchedules > 0) {
      kept++;
      continue;
    }
    const pattern = patternFor(emp.jobRole?.code);
    await prisma.$transaction(async (tx) => {
      const schedule = await tx.employeeWeeklySchedule.create({
        data: { employeeId: emp.id, effectiveFrom: new Date(`${EFFECTIVE_FROM}T00:00:00Z`) },
      });
      for (const day of WEEK) {
        const shifts = pattern.days[day] ?? [];
        await tx.employeeWeeklyScheduleDay.create({
          data: {
            weeklyScheduleId: schedule.id,
            dayOfWeek: day,
            status: shifts.length ? 'WORKING' : 'DAY_OFF',
            shifts: { create: shifts.map((name, i) => ({ shiftId: shiftIds[name], sequence: i + 1 })) },
          },
        });
      }
    });
    created++;
  }

  await prisma.systemSetting.create({
    data: {
      key: MARKER_KEY,
      value: new Date().toISOString(),
      description: 'Sample weekly schedules and timekeeping codes were added by the demo seed (prisma/demo/sample-schedules.js).',
    },
  });

  console.log('\nSample schedules');
  console.log(`  Weekly schedules created:  ${created}`);
  console.log(`  Already had one (kept):    ${kept}`);
  console.log(`  Timekeeping codes set:     ${codesSet}`);
}

module.exports = { seedSampleSchedules, ROLE_PATTERNS, SHIFTS, WEEK, MISSING_CODES, EFFECTIVE_FROM, HR_UNIT_CODE, patternFor };
