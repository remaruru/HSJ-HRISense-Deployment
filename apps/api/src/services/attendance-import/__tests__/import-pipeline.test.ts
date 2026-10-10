/**
 * End-to-end test of the import pipeline against a real database.
 *
 * Everything above the parser — staging, employee matching, classification,
 * the schedule/leave/holiday overlap engine, the apply guards and idempotency —
 * only exists in relation to stored data, so unit tests cannot prove it. This
 * drives the actual service.
 *
 * ── Which database ───────────────────────────────────────────────────────────
 * `hrisense_migration_dev_db`, the project's migration-authoring database. It is
 * scratch by design and holds no real records. The test refuses to run anywhere
 * else, so it can never touch `hrisense_db`, and it cleans up after itself.
 *
 * Employees here are invented (QA-…); nothing comes from a real export.
 */

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'mysql://root@localhost:3306/hrisense_migration_dev_db';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from '../../../config/prisma';
import { AttendanceImportService } from '../attendance-import.service';
import { buildFixtureWorkbook } from './fixture-builder';

if (!/hrisense_migration_dev_db/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing to run: this test only runs against hrisense_migration_dev_db.');
}

const CODE_A = 'QA901';
const CODE_B = 'QA902';
const UNMAPPED = 'QA999';
const TAG = 'QA-IMPORT-TEST';

let unitId: string;
let jobRoleId: string;
let employeeA: string;
let employeeB: string;
let userId: string;
const tempFiles: string[] = [];
const batchIds: string[] = [];

/** Writes a fixture workbook to a temp file and returns its path. */
function fixtureFile(employees: Parameters<typeof buildFixtureWorkbook>[0]['employees']): string {
  const buffer = buildFixtureWorkbook({ employees, periodStart: '2026-09-01', periodEnd: '2026-09-05' });
  const file = path.join(os.tmpdir(), `qa-mustard-${Date.now()}-${Math.random().toString(16).slice(2)}.xls`);
  fs.writeFileSync(file, buffer);
  tempFiles.push(file);
  return file;
}

async function runImport(file: string) {
  const { batch } = await AttendanceImportService.createBatch(
    { path: file, originalname: path.basename(file), size: fs.statSync(file).size, filename: path.basename(file) },
    userId
  );
  batchIds.push(batch.id);
  await AttendanceImportService.parseAndClassify(batch.id, file);
  return batch.id;
}

const candidates = (batchId: string) =>
  prisma.attendanceImportCandidate.findMany({ where: { batchId }, orderBy: { date: 'asc' } });

before(async () => {
  // A throwaway org, employees and user. Everything carries the tag so cleanup
  // can find it even if a run dies halfway.
  const unit = await prisma.unit.create({ data: { code: 'QAU', name: `${TAG} Unit` } });
  unitId = unit.id;
  const role = await prisma.jobRole.create({
    data: { code: 'QAR', title: `${TAG} Role`, unitId, permissionTier: 'STANDARD' },
  });
  jobRoleId = role.id;

  const user = await prisma.user.create({
    data: { email: `qa-import-${Date.now()}@example.test`, passwordHash: 'x', isActive: true },
  });
  userId = user.id;

  const mk = async (code: string | null, number: string) => {
    const e = await prisma.employee.create({
      data: {
        employeeNumber: number,
        firstName: 'Test',
        lastName: `Employee ${number}`,
        gender: 'PREFER_NOT_TO_SAY',
        dateOfBirth: new Date('1990-01-01'),
        civilStatus: 'SINGLE',
        nationality: 'Filipino',
        mobilePhone: '09170000000',
        presentAddress: 'QA',
        emergencyContactName: 'QA',
        emergencyContactRel: 'QA',
        emergencyContactPhone: '09170000000',
        hireDate: new Date('2020-01-01'),
        employmentStatus: 'REGULAR',
        employmentState: 'ACTIVE',
        unitId,
        jobRoleId,
        biometricCode: code,
      },
    });
    return e.id;
  };
  employeeA = await mk(CODE_A, `${TAG}-A`);
  employeeB = await mk(CODE_B, `${TAG}-B`);
});

after(async () => {
  for (const id of batchIds) {
    await prisma.attendanceImportCandidate.deleteMany({ where: { batchId: id } });
    await prisma.attendanceImportRawRow.deleteMany({ where: { batchId: id } });
  }
  await prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: [employeeA, employeeB] } } });
  await prisma.attendanceImportBatch.deleteMany({ where: { id: { in: batchIds } } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: [employeeA, employeeB] } } });
  await prisma.organizationCalendarEntry.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.employee.deleteMany({ where: { id: { in: [employeeA, employeeB] } } });
  await prisma.jobRole.deleteMany({ where: { id: jobRoleId } });
  await prisma.unit.deleteMany({ where: { id: unitId } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  for (const f of tempFiles) fs.rmSync(f, { force: true });
  await prisma.$disconnect();
});

describe('Import pipeline — matching and staging', () => {
  test('a mapped code imports; an unmapped one is held back, never guessed', async () => {
    const batchId = await runImport(
      fixtureFile([
        { code: CODE_A, name: 'Test Employee A', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']], hours: { worked: 8 } }] },
        { code: UNMAPPED, name: 'Test Employee X', days: [{ date: '2026-09-01', pairs: [['08:00', '17:00']], hours: { worked: 8 } }] },
      ])
    );

    const rows = await candidates(batchId);
    assert.equal(rows.length, 2);

    const matched = rows.find((r) => r.sourceEmployeeCode === CODE_A)!;
    assert.equal(matched.employeeId, employeeA);
    assert.equal(matched.classification, 'NEW');

    const unmatched = rows.find((r) => r.sourceEmployeeCode === UNMAPPED)!;
    assert.equal(unmatched.employeeId, null, 'an unmapped code must never be attached to anyone');
    assert.equal(unmatched.classification, 'UNKNOWN_EMPLOYEE');

    // Raw rows are staged verbatim regardless of whether they could be matched.
    const raw = await prisma.attendanceImportRawRow.count({ where: { batchId } });
    assert.equal(raw, 2);
  });

  test('applying writes the matched day and leaves the unmatched one alone', async () => {
    const batchId = await runImport(
      fixtureFile([
        { code: CODE_A, name: 'Test Employee A', days: [{ date: '2026-09-02', pairs: [['08:00', '12:00'], ['13:00', '17:00']], hours: { worked: 8 } }] },
        { code: UNMAPPED, name: 'Test Employee X', days: [{ date: '2026-09-02', pairs: [['08:00', '17:00']], hours: { worked: 8 } }] },
      ])
    );
    const batch = await AttendanceImportService.apply(batchId, userId);
    assert.equal(batch.countApplied, 1);

    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employeeA, date: new Date('2026-09-02T00:00:00.000Z') } },
    });
    assert.ok(record, 'the matched day should now exist');
    assert.equal(record!.sourceType, 'IMPORT');
    // Both sessions survive the round trip — not just first-in / last-out.
    assert.deepEqual(record!.sessions, [
      { in: '08:00', out: '12:00' },
      { in: '13:00', out: '17:00' },
    ]);
  });
});

describe('Import pipeline — idempotency', () => {
  test('re-importing the same file changes nothing and writes nothing', async () => {
    const day = { date: '2026-09-03', pairs: [['08:00', '17:00']] as Array<[string | null, string | null]>, hours: { worked: 8 } };
    const first = await runImport(fixtureFile([{ code: CODE_A, name: 'Test Employee A', days: [day] }]));
    await AttendanceImportService.apply(first, userId);

    const after = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employeeA, date: new Date('2026-09-03T00:00:00.000Z') } },
    });
    const versionAfterFirst = after!.recordVersion;
    const updatedAtAfterFirst = after!.updatedAt;

    const second = await runImport(fixtureFile([{ code: CODE_A, name: 'Test Employee A', days: [day] }]));
    const rows = await candidates(second);
    assert.equal(rows[0].classification, 'EXACT_DUPLICATE');

    const applied = await AttendanceImportService.apply(second, userId);
    assert.equal(applied.countApplied, 0, 'an exact duplicate must not write');

    const unchanged = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employeeA, date: new Date('2026-09-03T00:00:00.000Z') } },
    });
    assert.equal(unchanged!.recordVersion, versionAfterFirst, 'no write, so no version bump');
    assert.deepEqual(unchanged!.updatedAt, updatedAtAfterFirst, 'updatedAt must not move either');

    const count = await prisma.attendanceRecord.count({
      where: { employeeId: employeeA, date: new Date('2026-09-03T00:00:00.000Z') },
    });
    assert.equal(count, 1, 'never a second record for the same employee-day');
  });

  test('changed source data becomes a conflict and blocks confirmation', async () => {
    const changed = await runImport(
      fixtureFile([{ code: CODE_A, name: 'Test Employee A', days: [{ date: '2026-09-03', pairs: [['08:02', '17:01']], hours: { worked: 8 } }] }])
    );
    const rows = await candidates(changed);
    assert.equal(rows[0].classification, 'CONFLICT');
    assert.equal(rows[0].hrDecision, 'PENDING');

    await assert.rejects(
      () => AttendanceImportService.apply(changed, userId),
      /need a decision/,
      'a batch with an undecided conflict must not apply'
    );
  });
});

describe('Import pipeline — overlaps with HRISense facts', () => {
  test('a punch on an approved leave day keeps both facts and flags the clash', async () => {
    await prisma.leaveRequest.create({
      data: {
        employeeId: employeeB,
        leaveType: 'VACATION',
        startDate: new Date('2026-09-04T00:00:00.000Z'),
        endDate: new Date('2026-09-04T00:00:00.000Z'),
        totalDays: 1,
        reason: `${TAG} leave`,
        status: 'APPROVED',
      },
    });

    const batchId = await runImport(
      fixtureFile([{ code: CODE_B, name: 'Test Employee B', days: [{ date: '2026-09-04', pairs: [['08:00', '17:00']], hours: { worked: 8 } }] }])
    );
    const row = (await candidates(batchId))[0];
    const flags = (row.reviewFlags ?? []) as string[];

    assert.ok(flags.includes('ATTENDANCE_DURING_APPROVED_LEAVE'), `expected the leave clash, got ${JSON.stringify(flags)}`);
    // The leave itself is untouched — the import never cancels an approval.
    const leave = await prisma.leaveRequest.findFirst({ where: { employeeId: employeeB } });
    assert.equal(leave!.status, 'APPROVED');
  });

  test('a punch on a holiday keeps both facts', async () => {
    await prisma.organizationCalendarEntry.create({
      data: {
        name: `${TAG} Holiday`,
        date: new Date('2026-09-05T00:00:00.000Z'),
        type: 'HOLIDAY',
        status: 'APPROVED',
        source: 'MANUAL',
      },
    });

    const batchId = await runImport(
      fixtureFile([{ code: CODE_B, name: 'Test Employee B', days: [{ date: '2026-09-05', pairs: [['08:00', '17:00']], hours: { worked: 8 } }] }])
    );
    const row = (await candidates(batchId))[0];
    const flags = (row.reviewFlags ?? []) as string[];
    assert.ok(flags.includes('WORKED_ON_HOLIDAY'), `expected the holiday clash, got ${JSON.stringify(flags)}`);
  });

  test('a listed day with no punches is never written as attendance', async () => {
    const batchId = await runImport(
      fixtureFile([{ code: CODE_B, name: 'Test Employee B', days: [{ date: '2026-09-01', pairs: [], hours: { worked: 0 } }] }])
    );
    const row = (await candidates(batchId))[0];
    assert.equal(row.hrDecision, 'SKIP', 'an empty day must default to skip');

    await AttendanceImportService.apply(batchId, userId);
    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employeeB, date: new Date('2026-09-01T00:00:00.000Z') } },
    });
    assert.equal(record, null, 'a day with no punches must not become an attendance record');
  });
});
