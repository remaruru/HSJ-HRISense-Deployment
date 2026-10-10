/**
 * Generates a sample Mustard Seedtime timesheet (.xls) from the employees that
 * are actually in this database, so the attendance importer can be exercised
 * end to end without handing round a real payroll export.
 *
 * It reuses the very builder the parser tests are written against, so the file
 * it produces has the same shape the parser is proven to read: legacy BIFF,
 * empty column B, serial dates and times, per-block headers and footers.
 *
 * Every anomaly the normalizer can flag is planted somewhere in the output on
 * purpose — see PLANTED below — so a run over this file exercises the review
 * path and not just the happy one.
 *
 *   npx tsx scripts/generate-sample-timesheet.ts [outputPath] [--apply-codes]
 *
 * `--apply-codes` also writes each generated device number onto that employee's
 * `biometricCode`, which is what makes the file resolve on import. It is exactly
 * what the mapping panel writes, and it is undone with:
 *   UPDATE employees SET biometricCode = NULL WHERE biometricCode REGEXP '^9[0-4][0-9]$';
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildFixtureWorkbook, type FixtureDay, type FixtureEmployee } from '../src/services/attendance-import/__tests__/fixture-builder';
import { AttendanceDayContextService } from '../src/services/attendance-import/day-context.service';

const prisma = new PrismaClient();

const PERIOD_START = '2026-09-01';
// Ends before today on purpose: a date in the future is a genuine error
// condition (FUTURE_DATE), not something a realistic export carries.
const PERIOD_END = '2026-09-28';
/**
 * The device numbers written into the file, one per employee, from here up.
 *
 * Deliberately OUTSIDE the range the real device uses. The official export's
 * codes run 2-217; the first version of this script used 101-149, which put 23
 * of its test codes on top of real device numbers. Mapped onto HRISense
 * employees, those collided with real people's attendance the moment the real
 * file was imported - the importer caught every one as a name mismatch, but test
 * data should never be able to cause that in the first place.
 */
const FIRST_CODE = 901;
/** What the official export reports as `Hrs Required` on a working day. */
const REQUIRED_HOURS = 9;
/** Employees left without a code on purpose, so the mapping panel has work. */
const LEAVE_UNMAPPED = 4;

/** Deterministic, so re-running produces the same file. */
function rng(seed: number) {
  let s = seed * 2654435761 % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * One anomaly per employee index, so each flag the importer can raise appears
 * at least once and HR can see what the review queue looks like.
 */
const PLANTED: Record<number, { date: string; build: (d: FixtureDay) => FixtureDay }> = {
  // MULTIPLE_SESSIONS - a lunch punch-out cut into the employee's OWN day, so the
  // split lands inside their real shift rather than at fixed morning times.
  0: {
    date: '2026-09-02',
    build: (d) => {
      const [inT, outT] = d.pairs?.[0] ?? ['07:30', '17:00'];
      const start = toMin(inT as string);
      const end = toMin(outT as string);
      const mid = Math.round((start + end) / 2);
      return { ...d, pairs: [[inT, hhmm(mid - 20)], [hhmm(mid + 20), outT]] };
    },
  },
  1: { date: '2026-09-03', build: (d) => ({ ...d, pairs: [['07:41', null]] }) },                              // INCOMPLETE_PUNCH
  2: { date: '2026-09-04', build: (d) => ({ ...d, pairs: [[null, '17:12']] }) },                              // OUT_WITHOUT_IN
  3: { date: '2026-09-07', build: (d) => ({ ...d, pairs: [['17:03', '07:35']] }) },                           // NON_SEQUENTIAL_PUNCHES
  4: { date: '2026-09-08', build: (d) => ({ ...d, pairs: [], hours: { required: REQUIRED_HOURS, break: 0, worked: 8 } }) },// HOURS_WITHOUT_PUNCHES
  5: { date: '2026-09-09', build: (d) => ({ ...d, pairs: [['07:30', '16:30']], hours: { required: REQUIRED_HOURS, break: 0, worked: 0 } }) }, // PUNCHES_WITHOUT_HOURS
  6: { date: '2026-09-10', build: (d) => ({ ...d, pairs: [['07:28', '17:06']], hours: { required: REQUIRED_HOURS, break: 0, worked: 3 } }) }, // HOURS_DISAGREE_WITH_PUNCHES
};

/** The one APPROVED holiday inside the period — a punch here is a real conflict. */
const HOLIDAY = '2026-09-28';

/** A day's scheduled shifts, as HRISense resolves them. Empty when none. */
type ShiftsByDate = Map<string, { status: string | null; shifts: Array<{ startTime: string; endTime: string }> }>;

const toMin = (hhmmss: string) => {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
};

function buildDays(index: number, seed: number, schedule: ShiftsByDate): FixtureDay[] {
  const rand = rng(seed);
  const planted = PLANTED[index];
  // A couple of weekdays with nothing on them at all, per employee.
  const blanks = new Set<string>();

  return eachDate(PERIOD_START, PERIOD_END).map((date) => {
    const day = dow(date);
    const weekend = day === 0 || day === 6;

    // Weekends and a few scattered weekdays carry no punches and no hours. The
    // export still lists the date; the importer must skip these rather than
    // invent an ABSENT.
    if (weekend) return { date, pairs: [], hours: {} };

    const roll = rand();
    if (roll < 0.06 && blanks.size < 2) {
      blanks.add(date);
      return { date, pairs: [], hours: {} };
    }

    // The holiday: the first eight employees came in, everyone else did not.
    if (date === HOLIDAY && index >= 8) return { date, pairs: [], hours: {} };

    // Punch around the shift the employee is ACTUALLY scheduled for. The first
    // version gave everybody a 07:30 start, so an employee rostered 13:00-18:00
    // was flagged as outside their schedule every single day - correctly, but
    // it filled the review queue with noise the sample had manufactured.
    const today = schedule.get(date);
    if (today?.status === 'DAY_OFF') return { date, pairs: [], hours: {} };
    const shifts = (today?.shifts ?? []).filter((sh) => sh.startTime && sh.endTime);
    const shiftStart = shifts.length ? Math.min(...shifts.map((sh) => toMin(sh.startTime))) : 7 * 60 + 30;
    const shiftEnd = shifts.length ? Math.max(...shifts.map((sh) => toMin(sh.endTime))) : 17 * 60;
    const required = shifts.length
      ? Math.round((shifts.reduce((t, sh) => t + (toMin(sh.endTime) - toMin(sh.startTime)), 0) / 60) * 100) / 100
      : REQUIRED_HOURS;

    const inMin = shiftStart - 15 + Math.floor(rand() * 35);   // up to 15 min early, 20 late
    const outMin = shiftEnd - 20 + Math.floor(rand() * 55);    // up to 20 min early, 35 late
    // Hour conventions read off the official export rather than invented:
    //
    //   Hrs Required    9 on a working day, 0 on a day with nothing recorded
    //   Tot Hrs Break   0 throughout - the device reports it, never deducts it
    //   Worked + OT     tracks the punch span
    //   Hrs UT          required minus worked
    //
    // Matching them keeps the normalizer's hours-vs-punches check quiet on
    // ordinary days, so the days that are deliberately inconsistent stand out.
    const breakHrs = 0;
    const span = Math.round(((outMin - inMin) / 60) * 100) / 100;
    const worked = Math.min(required, span);
    const overtime = Math.round(Math.max(0, span - required) * 100) / 100;
    const undertime = Math.round(Math.max(0, required - worked) * 100) / 100;

    const base: FixtureDay = {
      date,
      pairs: [[hhmm(inMin), hhmm(outMin)]],
      hours: { required, break: breakHrs, worked, overtime, undertime },
    };

    return planted && planted.date === date ? planted.build(base) : base;
  });
}

/** `SURNAME, FIRSTNAME M` the way a bio device prints it — blanks tolerated. */
function deviceName(e: { lastName: string; firstName: string; middleName: string | null }): string {
  const last = e.lastName?.trim();
  const first = [e.firstName?.trim(), e.middleName?.trim()].filter(Boolean).join(' ');
  return (last && first ? `${last}, ${first}` : last || first || 'UNNAMED').toUpperCase();
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, employmentState: 'ACTIVE' },
    select: { id: true, employeeNumber: true, lastName: true, firstName: true, middleName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  if (!employees.length) throw new Error('No active employees in this database.');

  const mappedCount = Math.max(0, employees.length - LEAVE_UNMAPPED);

  // Every employee's resolved schedule for the whole period, in one pass - the
  // same resolution the importer's day-context check uses.
  const dates = eachDate(PERIOD_START, PERIOD_END);
  const contexts = await AttendanceDayContextService.loadMany(
    employees.flatMap((e) => dates.map((date) => ({ employeeId: e.id, date })))
  );
  const scheduleFor = (employeeId: string): ShiftsByDate =>
    new Map(dates.map((date) => {
      const c = contexts.get(`${employeeId}|${date}`);
      return [date, { status: c?.scheduleStatus ?? null, shifts: c?.shifts ?? [] }];
    }));

  const blocks: FixtureEmployee[] = employees.map((e, i) => ({
    // Every block carries a code; whether it RESOLVES depends on the employee's
    // biometricCode in the database, which is what the mapping panel edits.
    code: String(FIRST_CODE + i),
    name: deviceName(e),
    days: buildDays(i, i + 1, scheduleFor(e.id)),
  }));

  const buffer = buildFixtureWorkbook({
    employees: blocks,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  });

  const out = resolve(process.argv.find((a) => !a.startsWith('--') && a.endsWith('.xls')) ?? 'sample-timesheet.xls');
  writeFileSync(out, buffer);

  if (process.argv.includes('--apply-codes')) {
    // Only the first `mappedCount` get a code. The rest stay unmapped on purpose
    // so the import has real UNKNOWN_EMPLOYEE rows to map by hand.
    for (let i = 0; i < mappedCount; i++) {
      await prisma.employee.update({
        where: { id: employees[i].id },
        data: { biometricCode: blocks[i].code },
      });
    }
    // The employees left unmapped must not keep a sample code from an earlier
    // run - if the roster order shifts, one could otherwise linger on the wrong
    // person. Only the exact codes this script issues are touched, and they sit
    // in the 9xx range precisely so they can never be mistaken for a real device
    // number (the real range is 2-217) that HR mapped by hand.
    const issuedBySample = Array.from({ length: employees.length }, (_, k) => String(FIRST_CODE + k));
    for (let i = mappedCount; i < employees.length; i++) {
      await prisma.employee.updateMany({
        where: { id: employees[i].id, biometricCode: { in: issuedBySample } },
        data: { biometricCode: null },
      });
    }
    console.log(`applied ${mappedCount} biometric codes; ${employees.length - mappedCount} left unmapped
`);
  }

  // The key HR needs to map codes to people, printed rather than written into
  // the workbook — the parser drops names on purpose.
  console.log(`wrote ${out} (${(buffer.length / 1024).toFixed(0)} KB)`);
  console.log(`period ${PERIOD_START} … ${PERIOD_END}, ${blocks.length} employees\n`);
  console.log('code  employeeNumber  name                             mapped');
  blocks.forEach((b, i) => {
    console.log(
      `${b.code!.padEnd(6)}${employees[i].employeeNumber.padEnd(16)}${b.name.slice(0, 32).padEnd(33)}${i < mappedCount ? 'yes' : 'NO — map by hand'}`
    );
  });
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
