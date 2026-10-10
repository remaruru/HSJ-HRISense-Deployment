import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MustardSeedtimeReader, MustardParseError } from '../mustard-seedtime.reader';
import { MustardSeedtimeNormalizer, toRawSourceRows, MUSTARD_FLAGS } from '../mustard-seedtime.normalizer';
import { AttendanceImportClassificationService } from '../classification.service';
import { AttendanceDayContextService, DAY_FLAGS, type DayContext } from '../day-context.service';
import { buildFixtureWorkbook, type FixtureEmployee } from './fixture-builder';
import type { NormalizedDailyCandidate } from '../normalizer';

/**
 * Parser and conflict tests, built on synthetic fixtures only.
 *
 * Nothing here is copied from a real export: every employee is QA-00n and every
 * figure is invented. The fixtures reproduce the FORMAT — including the empty
 * column B, serial dates and times, blank rows and footer lines — so a parser
 * that passes these will read the production workbook too.
 */

const NOW = () => new Date('2026-09-30T00:00:00Z');

async function normalize(employees: FixtureEmployee[], matched = true) {
  const buffer = buildFixtureWorkbook({ employees, periodStart: '2026-09-01', periodEnd: '2026-09-30' });
  const workbook = MustardSeedtimeReader.read(buffer);
  const rows = toRawSourceRows(workbook);
  const normalizer = new MustardSeedtimeNormalizer({
    resolveEmployeeIdsByCode: async (codes) =>
      matched ? new Map(codes.map((c) => [c, `emp-${c}`])) : new Map(),
    now: NOW,
  });
  const result = await normalizer.normalize(rows);
  return { workbook, rows, candidates: result.candidates };
}

const day = (c: NormalizedDailyCandidate[], date: string) => c.find((x) => x.date === date)!;

describe('Mustard Seedtime reader — structure', () => {
  test('reads blocks, codes, period and footers from a legacy .xls', async () => {
    const { workbook } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] },
      { code: '102', name: 'Test Employee B', days: [{ date: '2026-09-01', pairs: [['09:00', '18:00']] }] },
    ]);
    assert.equal(workbook.sheetName, 'Sheet1');
    assert.equal(workbook.blocks.length, 2);
    assert.deepEqual(workbook.blocks.map((b) => b.code), ['101', '102']);
    assert.equal(workbook.reportPeriod.start, '2026-09-01');
    assert.equal(workbook.reportPeriod.end, '2026-09-30');
    assert.equal(workbook.reportTotals.employees, 2);
  });

  /**
   * The name used to be dropped outright. It is now kept on ONE clearly-marked
   * transient field so a reassigned device code can be caught - and nowhere
   * else. The guarantee is therefore narrower than it was, and this test pins
   * the new line: the label is still name-free, and nothing that gets persisted
   * carries it. `toRawSourceRows` is covered separately.
   */
  test('keeps the name only on the transient verification field', async () => {
    const { workbook } = await normalize([
      { code: '101', name: 'Surname, Given Name', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] },
    ]);
    const block = workbook.blocks[0];
    assert.equal(block.label, 'Employee (101)', 'the label must stay name-free');

    const { nameForVerificationOnly, ...rest } = block;
    assert.ok(nameForVerificationOnly?.includes('Surname'), 'verification needs the name');
    assert.ok(
      !JSON.stringify(rest).includes('Surname'),
      'no other part of the block may carry the name'
    );
  });

  test('footer rows never become attendance days', async () => {
    const { workbook, candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']] },
        { date: '2026-09-02', pairs: [['08:00', '17:00']] },
      ], daysPresent: 2, daysAbsent: 0 },
    ]);
    assert.equal(workbook.blocks[0].days.length, 2);
    assert.equal(candidates.length, 2);
    assert.deepEqual(workbook.blocks[0].footer, { daysPresent: 2, daysAbsent: 0 });
  });

  test('accepts an alphanumeric code, but not a name ending in a parenthetical', async () => {
    // Every code in the official export is numeric; requiring digits only would
    // silently invalidate a whole block if a device ever emitted letters.
    const { workbook } = await normalize([
      { code: 'QA901', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] },
    ]);
    assert.equal(workbook.blocks[0].code, 'QA901');

    // "(JR)" is a name suffix, not an identifier — it has no digit.
    const suffix = buildFixtureWorkbook({
      employees: [{ code: 'JR', name: 'Test Employee B', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] }],
      periodStart: '2026-09-01', periodEnd: '2026-09-30',
    });
    assert.equal(MustardSeedtimeReader.read(suffix).blocks[0].code, null);
  });

  test('rejects a workbook that is not a timesheet', () => {
    const buffer = buildFixtureWorkbook({ employees: [], omitMarker: true });
    assert.throws(() => MustardSeedtimeReader.read(buffer), MustardParseError);
  });
});

describe('Punch handling', () => {
  test('a normal day keeps its single session', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']], hours: { required: 8, worked: 8 } },
      ] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.deepEqual(d.sessions, [{ in: '08:00', out: '17:00' }]);
    assert.equal(d.status, null, 'the importer must not assign a status');
  });

  test('two sessions are both preserved, not flattened', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '12:00'], ['13:00', '17:00']], hours: { worked: 8 } },
      ] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.deepEqual(d.sessions, [{ in: '08:00', out: '12:00' }, { in: '13:00', out: '17:00' }]);
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.MULTIPLE_SESSIONS));
  });

  test('all six pairs survive', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [
          ['06:00', '07:00'], ['08:00', '09:00'], ['10:00', '11:00'],
          ['12:00', '13:00'], ['14:00', '15:00'], ['16:00', '17:00'],
        ] },
      ] },
    ]);
    assert.equal(day(candidates, '2026-09-01').sessions?.length, 6);
  });

  test('an unclosed pair is flagged and never completed', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', null]] }] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.equal(d.timeOut, null, 'an out time must never be invented');
    assert.deepEqual(d.sessions, [{ in: '08:00', out: null }]);
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.INCOMPLETE_PUNCH));
  });

  test('an out with no in is flagged and never completed', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [[null, '17:00']] }] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.equal(d.timeIn, null, 'an in time must never be invented');
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.OUT_WITHOUT_IN));
  });

  test('an out earlier than its in is preserved and flagged, not re-dated', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['22:00', '06:00']] }] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.deepEqual(d.sessions, [{ in: '22:00', out: '06:00' }]);
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.NON_SEQUENTIAL_PUNCHES));
    // Neither punch is moved to another calendar day. Checked in Manila time,
    // which is the day the file is describing — the two instants legitimately
    // fall on different UTC dates because 22:00 and 06:00 straddle midnight UTC.
    const manilaDay = (v: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(v);
    assert.equal(manilaDay(d.timeIn!), '2026-09-01');
    assert.equal(manilaDay(d.timeOut!), '2026-09-01');
  });

  test('a listed day with no punches carries no attendance fact to write', async () => {
    // The export lists every date for every employee, so most of these rows are
    // simply "the device saw nothing". Importing them as records would assert
    // attendance that never happened.
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [], hours: { worked: 0 } }] },
    ]);
    const d = day(candidates, '2026-09-01');
    const carriesNoFact = !d.sessions?.length && !(d.hoursWorked ?? 0);
    assert.equal(carriesNoFact, true);
  });

  test('a day with no punches is not an absence', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [] }] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.equal(d.status, null);
    assert.equal(d.sessions, null);
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.NO_PUNCHES));
  });
});

describe('Hours columns', () => {
  test('punches with blank hours keep the punches and flag the gap', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']], hours: { worked: 0 } },
      ] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.deepEqual(d.sessions, [{ in: '08:00', out: '17:00' }]);
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.PUNCHES_WITHOUT_HOURS));
  });

  test('hours that disagree with the punches are reported, never replaced', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']], hours: { worked: 2, overtime: 0 } },
      ] },
    ]);
    const d = day(candidates, '2026-09-01');
    assert.equal(d.hoursWorked, 2, "the source's own figure is kept as exported");
    assert.deepEqual(d.sourceHours, { required: 0, break: 0, worked: 2, overtime: 0, undertime: 0 });
    assert.ok(d.reviewFlags.includes(MUSTARD_FLAGS.HOURS_DISAGREE_WITH_PUNCHES));
  });

  test('worked + overtime matching the span is not a disagreement', async () => {
    // The export reports overtime separately and excludes it from Hrs Worked.
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['06:02', '14:27']], hours: { worked: 6.45, overtime: 1.97 } },
      ] },
    ]);
    assert.ok(!day(candidates, '2026-09-01').reviewFlags.includes(MUSTARD_FLAGS.HOURS_DISAGREE_WITH_PUNCHES));
  });

  test('hours reported with no punches at all are flagged', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [], hours: { worked: 8 } }] },
    ]);
    assert.ok(day(candidates, '2026-09-01').reviewFlags.includes(MUSTARD_FLAGS.HOURS_WITHOUT_PUNCHES));
  });
});

describe('Bad data', () => {
  test('an unreadable date invalidates only its own row', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']] },
        { date: '2026-09-02', pairs: [['08:00', '17:00']], brokenDate: true },
        { date: '2026-09-03', pairs: [['08:00', '17:00']] },
      ] },
    ]);
    // The broken row is not a data row at all, so the other two still parse.
    assert.equal(candidates.length, 2);
    assert.ok(candidates.every((c) => !c.invalidReason));
  });

  test('an unreadable punch invalidates its row without stopping the import', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [
        { date: '2026-09-01', pairs: [['08:00', '17:00']], brokenPunch: true },
        { date: '2026-09-02', pairs: [['08:00', '17:00']] },
      ] },
    ]);
    assert.equal(candidates.length, 2);
    assert.match(day(candidates, '2026-09-01').invalidReason ?? '', /could not be read as a time/);
    assert.equal(day(candidates, '2026-09-02').invalidReason, null);
  });

  test('a future date is flagged, not treated as completed attendance', async () => {
    const { candidates } = await normalize([
      { code: '101', name: 'Test Employee A', days: [{ date: '2026-12-25', pairs: [['08:00', '17:00']] }] },
    ]);
    assert.ok(day(candidates, '2026-12-25').reviewFlags.includes(MUSTARD_FLAGS.FUTURE_DATE));
  });

  test('a block with no code produces rows nobody can be blamed for', async () => {
    const { candidates } = await normalize([
      { code: null, name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] },
    ]);
    assert.equal(candidates[0].employeeId, null);
    assert.match(candidates[0].invalidReason ?? '', /no identifier/);
  });
});

describe('Employee matching', () => {
  test('an unmapped code is never attached to anyone', async () => {
    const { candidates } = await normalize(
      [{ code: '999', name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']] }] }],
      false
    );
    const d = candidates[0];
    assert.equal(d.employeeId, null);
    assert.equal(d.sourceEmployeeIdentifier, '999');
    const outcome = AttendanceImportClassificationService.classify(d, null, new Set());
    assert.equal(outcome.classification, 'UNKNOWN_EMPLOYEE');
  });
});

describe('Classification against existing records', () => {
  const candidateFor = (overrides: Partial<NormalizedDailyCandidate> = {}): NormalizedDailyCandidate => ({
    sourceRowNumbers: [1],
    employeeId: 'emp-101',
    sourceEmployeeIdentifier: '101',
    date: '2026-09-01',
    timeIn: new Date('2026-09-01T00:00:00Z'),
    timeOut: new Date('2026-09-01T09:00:00Z'),
    status: null,
    hoursWorked: 8,
    overtimeHours: 0,
    sessions: [{ in: '08:00', out: '17:00' }],
    sourceHours: null,
    reviewFlags: [],
    invalidReason: null,
    ...overrides,
  });

  const existing = (overrides: Partial<Parameters<typeof AttendanceImportClassificationService.classify>[1] & object> = {}) => ({
    id: 'rec-1',
    timeIn: new Date('2026-09-01T00:00:00Z'),
    timeOut: new Date('2026-09-01T09:00:00Z'),
    status: 'PRESENT' as const,
    hoursWorked: 8,
    overtimeHours: 0,
    manuallyModifiedAt: null,
    recordVersion: 3,
    ...overrides,
  });

  test('re-importing identical data is an exact duplicate and writes nothing', () => {
    const outcome = AttendanceImportClassificationService.classify(candidateFor(), existing(), new Set());
    assert.equal(outcome.classification, 'EXACT_DUPLICATE');
    assert.equal(AttendanceImportClassificationService.canWrite(outcome.classification), false);
  });

  test('changed source data becomes a conflict for HR, not a silent overwrite', () => {
    const outcome = AttendanceImportClassificationService.classify(
      candidateFor({ timeOut: new Date('2026-09-01T09:02:00Z') }),
      existing(),
      new Set()
    );
    assert.equal(outcome.classification, 'CONFLICT');
    assert.equal(AttendanceImportClassificationService.defaultDecision(outcome.classification), 'PENDING');
  });

  test("a hand-corrected record defaults to keeping HR's version", () => {
    const outcome = AttendanceImportClassificationService.classify(
      candidateFor({ timeOut: new Date('2026-09-01T09:02:00Z') }),
      existing({ manuallyModifiedAt: new Date('2026-09-20T00:00:00Z') }),
      new Set()
    );
    assert.equal(outcome.classification, 'CONFLICT_MANUAL');
    assert.equal(AttendanceImportClassificationService.defaultDecision(outcome.classification), 'KEEP_EXISTING');
  });

  test('the same employee-day twice in one file does not duplicate', () => {
    const seen = new Set(['emp-101|2026-09-01']);
    const outcome = AttendanceImportClassificationService.classify(candidateFor(), null, seen);
    assert.equal(outcome.classification, 'DUPLICATE_IN_FILE');
  });

  test('an overlapping range re-imports unchanged days as duplicates and new days as new', () => {
    const unchanged = AttendanceImportClassificationService.classify(candidateFor(), existing(), new Set());
    const fresh = AttendanceImportClassificationService.classify(
      candidateFor({ date: '2026-09-20' }), null, new Set()
    );
    assert.equal(unchanged.classification, 'EXACT_DUPLICATE');
    assert.equal(fresh.classification, 'NEW');
  });
});

describe('Overlaps with schedule, leave and holidays', () => {
  const ctx = (over: Partial<DayContext> = {}): DayContext => ({
    scheduleStatus: 'WORKING', shifts: [], leave: null, holiday: null, ...over,
  });

  test('scheduled work with punches raises nothing', () => {
    assert.deepEqual(AttendanceDayContextService.flagsFor(ctx(), true), []);
  });

  test('a day off with punches keeps both facts', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ scheduleStatus: 'DAY_OFF' }), true);
    assert.ok(flags.includes(DAY_FLAGS.WORKED_ON_SCHEDULED_DAY_OFF));
  });

  test('a day off with no punches stays a day off', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ scheduleStatus: 'DAY_OFF' }), false);
    assert.deepEqual(flags, [DAY_FLAGS.DAY_OFF_NO_PUNCH]);
  });

  test('approved leave with punches keeps both facts', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ leave: { id: 'l1', leaveType: 'VACATION' } }), true);
    assert.ok(flags.includes(DAY_FLAGS.ATTENDANCE_DURING_APPROVED_LEAVE));
  });

  test('leave with no punches is leave, not a day off and not an absence', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ leave: { id: 'l1', leaveType: 'SICK' } }), false);
    assert.deepEqual(flags, [DAY_FLAGS.ON_LEAVE_NO_PUNCH]);
  });

  test('a holiday with punches keeps both facts', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ holiday: { id: 'h1', title: 'QA Holiday', type: 'HOLIDAY' } }), true);
    assert.ok(flags.includes(DAY_FLAGS.WORKED_ON_HOLIDAY));
  });

  test('a holiday with no punches stays a holiday', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ holiday: { id: 'h1', title: 'QA Holiday', type: 'HOLIDAY' } }), false);
    assert.deepEqual(flags, [DAY_FLAGS.HOLIDAY_NO_PUNCH]);
  });

  test('a unit HR marked as working on the holiday raises no holiday flag', () => {
    const working = { id: 'h1', title: 'QA Holiday', type: 'HOLIDAY', appliesToEmployee: false };
    const withPunches = AttendanceDayContextService.flagsFor(ctx({ scheduleStatus: 'WORKING', holiday: working }), true);
    assert.ok(!withPunches.includes(DAY_FLAGS.WORKED_ON_HOLIDAY));
    const noPunches = AttendanceDayContextService.flagsFor(ctx({ scheduleStatus: 'WORKING', holiday: working }), false);
    assert.ok(!noPunches.includes(DAY_FLAGS.HOLIDAY_NO_PUNCH));
  });

  test('a unit that observes the holiday still gets WORKED_ON_HOLIDAY', () => {
    const observed = { id: 'h1', title: 'QA Holiday', type: 'HOLIDAY', appliesToEmployee: true };
    const flags = AttendanceDayContextService.flagsFor(ctx({ holiday: observed }), true);
    assert.ok(flags.includes(DAY_FLAGS.WORKED_ON_HOLIDAY));
  });

  test('no configured schedule keeps the attendance and says so', () => {
    const flags = AttendanceDayContextService.flagsFor(ctx({ scheduleStatus: 'UNCONFIGURED' }), true);
    assert.ok(flags.includes(DAY_FLAGS.SCHEDULE_NOT_CONFIGURED));
  });

  test('punches well outside the shift are flagged, never judged', () => {
    const outside = AttendanceDayContextService.punchOutsideSchedule(
      ctx({ shifts: [{ startTime: '08:00', endTime: '17:00' }] }),
      [{ in: '03:00', out: '11:00' }]
    );
    assert.equal(outside, true);
    const inside = AttendanceDayContextService.punchOutsideSchedule(
      ctx({ shifts: [{ startTime: '08:00', endTime: '17:00' }] }),
      [{ in: '08:05', out: '17:10' }]
    );
    assert.equal(inside, false);
  });
});

/**
 * The name in the export is read for one purpose only - checking that a device
 * code still belongs to the person it is mapped to - and must not survive past
 * that. These tests pin the boundary, because a leak here would put employee
 * names from a payroll export into the database, the logs and the error
 * messages, which is exactly what the design set out to avoid.
 */
describe('the source name never escapes the reader', () => {
  const NAME = 'QATESTSURNAME, QATESTFIRST';
  const workbook = () =>
    MustardSeedtimeReader.read(
      buildFixtureWorkbook({
        periodStart: '2026-04-01',
        periodEnd: '2026-04-01',
        employees: [
          {
            code: 'QA707',
            name: NAME,
            days: [{ date: '2026-04-01', pairs: [['08:00', '17:00']], hours: { worked: 8 } }],
          },
        ],
      })
    );

  test('the block label carries the code and not the name', () => {
    const block = workbook().blocks[0];
    assert.equal(block.label, 'Employee (QA707)');
    assert.ok(!block.label.includes('QATESTSURNAME'));
  });

  test('the name is available for verification, and only there', () => {
    const block = workbook().blocks[0];
    assert.ok(block.nameForVerificationOnly?.includes('QATESTSURNAME'));
  });

  test('nothing staged for persistence contains the name', () => {
    const rows = toRawSourceRows(workbook());
    const serialised = JSON.stringify(rows);
    assert.ok(
      !serialised.toUpperCase().includes('QATESTSURNAME'),
      'the staged payload must never carry the source name'
    );
    assert.ok(!serialised.toUpperCase().includes('QATESTFIRST'));
  });
});

/**
 * A day whose hours AGREE with its punches but describes more time than a person
 * could work. The hours-vs-punches comparison cannot see this - both numbers are
 * consistent - so without its own check it imports silently. In practice it is a
 * clock-out that never happened, rolling one day into the next.
 */
describe('implausible day length', () => {
  const dayOf = async (pairs: Array<[string | null, string | null]>, worked: number) => {
    const { candidates } = await normalize([
      { code: 'QA808', name: 'QA Person', days: [{ date: '2026-05-04', pairs, hours: { worked } }] },
    ]);
    return candidates[0];
  };

  test('a twenty-hour span is flagged even when the hours agree with it', async () => {
    const day = await dayOf([['04:00', '23:59']], 19.9);
    assert.ok(day.reviewFlags.includes(MUSTARD_FLAGS.IMPLAUSIBLE_DURATION));
    assert.ok(
      !day.reviewFlags.includes(MUSTARD_FLAGS.HOURS_DISAGREE_WITH_PUNCHES),
      'the numbers agree - that is exactly why this needs its own check'
    );
  });

  test('a long but genuine day is left alone', async () => {
    const day = await dayOf([['06:00', '19:00']], 13);
    assert.ok(!day.reviewFlags.includes(MUSTARD_FLAGS.IMPLAUSIBLE_DURATION));
  });
});
