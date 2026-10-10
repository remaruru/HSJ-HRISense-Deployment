/**
 * READ-ONLY data integrity preflight.
 *
 * Run with:  npx tsx scripts/preflight-integrity-check.ts
 *
 * Performs no writes of any kind. Its purpose is to establish, before any schema
 * change, whether the live data would violate the constraints we intend to add,
 * and to size the existing integrity problems found in the design review.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function heading(text: string) {
  console.log('\n' + '─'.repeat(72));
  console.log(text);
  console.log('─'.repeat(72));
}

async function main() {
  console.log('HRISense — read-only data integrity preflight');
  console.log('No writes are performed by this script.');

  // ── 1. Duplicate EmployeeWeeklySchedule (employeeId + effectiveFrom) ────────
  heading('1. Duplicate weekly schedules (same employee + same effectiveFrom)');
  const dupSchedules = await prisma.$queryRaw<
    Array<{ employeeId: string; effectiveFrom: Date; n: bigint }>
  >`
    SELECT employeeId, effectiveFrom, COUNT(*) AS n
      FROM employee_weekly_schedules
     GROUP BY employeeId, effectiveFrom
    HAVING COUNT(*) > 1
  `;
  console.log(`rows: ${dupSchedules.length}`);
  for (const r of dupSchedules) {
    console.log(`  employee=${r.employeeId} effectiveFrom=${r.effectiveFrom} count=${r.n}`);
  }
  console.log(
    dupSchedules.length === 0
      ? '  => SAFE to add @@unique([employeeId, effectiveFrom])'
      : '  => BLOCKED: manual reconciliation required before the unique constraint'
  );

  // ── 2. Employees with more than one open-ended weekly schedule ──────────────
  heading('2. Employees with more than one open-ended weekly schedule (effectiveTo IS NULL)');
  const multiOpen = await prisma.$queryRaw<Array<{ employeeId: string; n: bigint }>>`
    SELECT employeeId, COUNT(*) AS n
      FROM employee_weekly_schedules
     WHERE effectiveTo IS NULL
     GROUP BY employeeId
    HAVING COUNT(*) > 1
  `;
  console.log(`employees affected: ${multiOpen.length}`);
  for (const r of multiOpen) console.log(`  employee=${r.employeeId} openEnded=${r.n}`);

  // ── 3. Overlapping weekly schedule effective ranges ────────────────────────
  heading('3. Overlapping weekly schedule effective ranges');
  const overlaps = await prisma.$queryRaw<
    Array<{ employeeId: string; aId: string; aFrom: Date; aTo: Date | null; bId: string; bFrom: Date }>
  >`
    SELECT a.employeeId   AS employeeId,
           a.id           AS aId,
           a.effectiveFrom AS aFrom,
           a.effectiveTo   AS aTo,
           b.id           AS bId,
           b.effectiveFrom AS bFrom
      FROM employee_weekly_schedules a
      JOIN employee_weekly_schedules b
        ON a.employeeId = b.employeeId
       AND a.id <> b.id
       AND b.effectiveFrom > a.effectiveFrom
       AND (a.effectiveTo IS NULL OR a.effectiveTo > b.effectiveFrom)
     ORDER BY a.employeeId, a.effectiveFrom
  `;
  console.log(`overlapping pairs: ${overlaps.length}`);
  for (const r of overlaps) {
    console.log(
      `  employee=${r.employeeId}  [${r.aFrom.toISOString().slice(0, 10)} -> ${
        r.aTo ? r.aTo.toISOString().slice(0, 10) : 'OPEN'
      }] overlaps next starting ${r.bFrom.toISOString().slice(0, 10)}`
    );
  }
  console.log(
    overlaps.length === 0
      ? '  => timeline is contiguous; no repair needed'
      : '  => deterministic repair available (set effectiveTo = next effectiveFrom)'
  );

  // ── 4. Duplicate training-generated compliance records ─────────────────────
  heading('4. Training participants linked to compliance records');
  const participantsWithCompliance = await prisma.trainingParticipant.count({
    where: { complianceRecordId: { not: null } },
  });
  const autoComplianceRecords = await prisma.employeeComplianceRecord.count({
    where: { referenceNumber: { startsWith: 'TRN-' }, deletedAt: null },
  });
  console.log(`training participants with a linked compliance record: ${participantsWithCompliance}`);
  console.log(`compliance records auto-generated from training (TRN- prefix): ${autoComplianceRecords}`);
  const orphanAuto = autoComplianceRecords - participantsWithCompliance;
  console.log(
    orphanAuto > 0
      ? `  => ${orphanAuto} possible ORPHAN auto-generated compliance record(s) — review`
      : '  => no orphan auto-generated compliance records detected'
  );

  // Same employee + requirement appearing more than once from training
  const dupAutoCompliance = await prisma.$queryRaw<
    Array<{ employeeId: string; requirementId: string; n: bigint }>
  >`
    SELECT employeeId, requirementId, COUNT(*) AS n
      FROM employee_compliance_records
     WHERE referenceNumber LIKE 'TRN-%' AND deletedAt IS NULL
     GROUP BY employeeId, requirementId
    HAVING COUNT(*) > 1
  `;
  console.log(`employee+requirement with >1 training-generated record: ${dupAutoCompliance.length}`);
  for (const r of dupAutoCompliance) {
    console.log(`  employee=${r.employeeId} requirement=${r.requirementId} count=${r.n}`);
  }

  // ── 5. Potentially duplicated notifications ────────────────────────────────
  heading('5. Potentially duplicated notifications (same user + type + title + link)');
  const dupNotifications = await prisma.$queryRaw<
    Array<{ userId: string; type: string; title: string; n: bigint }>
  >`
    SELECT userId, type, title, COUNT(*) AS n
      FROM notifications
     GROUP BY userId, type, title, link
    HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT 20
  `;
  console.log(`duplicate groups (top 20): ${dupNotifications.length}`);
  for (const r of dupNotifications) {
    console.log(`  user=${r.userId} type=${r.type} count=${r.n} title="${r.title.slice(0, 50)}"`);
  }
  console.log('  NOTE: repeated notifications may be legitimate (e.g. two separate leave requests).');

  // ── 6/7. Attendance record counts and date range ───────────────────────────
  heading('6/7. AttendanceRecord volume and date range');
  const attendanceCount = await prisma.attendanceRecord.count();
  console.log(`total attendance records: ${attendanceCount}`);
  if (attendanceCount > 0) {
    const range = await prisma.$queryRaw<Array<{ minDate: Date; maxDate: Date; distinctDays: bigint }>>`
      SELECT MIN(date) AS minDate, MAX(date) AS maxDate, COUNT(DISTINCT date) AS distinctDays
        FROM attendance_records
    `;
    const r = range[0];
    console.log(`date range: ${r.minDate?.toISOString().slice(0, 10)} .. ${r.maxDate?.toISOString().slice(0, 10)}`);
    console.log(`distinct dates: ${r.distinctDays}`);

    const byStatus = await prisma.attendanceRecord.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    for (const s of byStatus) console.log(`  ${s.status}: ${s._count._all}`);

    // Attendance belonging to non-active employees (the SW-05 population gap)
    const nonActive = await prisma.attendanceRecord.count({
      where: { employee: { OR: [{ deletedAt: { not: null } }, { employmentState: { not: 'ACTIVE' } }] } },
    });
    console.log(`attendance rows belonging to archived/non-active employees: ${nonActive}`);
  }

  // ── 8. Leave balance sanity ────────────────────────────────────────────────
  heading('8. Leave balance sanity');
  const balances = await prisma.leaveBalance.findMany({
    select: { id: true, employeeId: true, year: true, leaveType: true, totalAllotted: true, used: true, pending: true, forfeited: true },
  });
  console.log(`total leave balances: ${balances.length}`);
  const negative = balances.filter((b) => b.used < 0 || b.pending < 0 || b.forfeited < 0);
  const overspent = balances.filter((b) => b.used + b.pending + b.forfeited > b.totalAllotted);
  console.log(`balances with a negative component: ${negative.length}`);
  for (const b of negative) {
    console.log(`  employee=${b.employeeId} ${b.year} ${b.leaveType} used=${b.used} pending=${b.pending} forfeited=${b.forfeited}`);
  }
  console.log(`balances where used+pending+forfeited > totalAllotted: ${overspent.length}`);
  for (const b of overspent) {
    console.log(`  employee=${b.employeeId} ${b.year} ${b.leaveType} total=${b.totalAllotted} used=${b.used} pending=${b.pending} forfeited=${b.forfeited}`);
  }

  // Pending days that no longer correspond to an undecided request
  const undecided = await prisma.leaveRequest.findMany({
    where: { status: { in: ['PENDING', 'FOR_REVIEW'] }, deletedAt: null },
    select: { employeeId: true, leaveType: true, totalDays: true, startDate: true },
  });
  const expectedPending = new Map<string, number>();
  for (const r of undecided) {
    const key = `${r.employeeId}|${r.startDate.getFullYear()}|${r.leaveType}`;
    expectedPending.set(key, (expectedPending.get(key) ?? 0) + r.totalDays);
  }
  let pendingMismatch = 0;
  for (const b of balances) {
    const key = `${b.employeeId}|${b.year}|${b.leaveType}`;
    const expected = expectedPending.get(key) ?? 0;
    if (Math.abs(expected - b.pending) > 0.001) {
      pendingMismatch++;
      console.log(
        `  pending mismatch: employee=${b.employeeId} ${b.year} ${b.leaveType} stored=${b.pending} expectedFromRequests=${expected}`
      );
    }
  }
  console.log(`balances whose stored pending disagrees with undecided requests: ${pendingMismatch}`);

  // ── 10. Work schedule model usage ──────────────────────────────────────────
  heading('10. Scheduling model usage');
  const weeklyCount = await prisma.employeeWeeklySchedule.count();
  const assignmentCount = await prisma.employeeScheduleAssignment.count();
  const templateCount = await prisma.scheduleTemplate.count();
  const shiftCount = await prisma.shiftDefinition.count();
  const employeesTotal = await prisma.employee.count({ where: { deletedAt: null } });
  const employeesWithWeekly = (
    await prisma.employeeWeeklySchedule.findMany({ distinct: ['employeeId'], select: { employeeId: true } })
  ).length;
  const employeesWithAssignment = (
    await prisma.employeeScheduleAssignment.findMany({ distinct: ['employeeId'], select: { employeeId: true } })
  ).length;

  console.log(`EmployeeWeeklySchedule rows: ${weeklyCount}  (employees covered: ${employeesWithWeekly})`);
  console.log(`EmployeeScheduleAssignment rows: ${assignmentCount}  (employees covered: ${employeesWithAssignment})`);
  console.log(`ScheduleTemplate rows: ${templateCount}`);
  console.log(`ShiftDefinition rows: ${shiftCount}`);
  console.log(`non-deleted employees: ${employeesTotal}`);

  const bothSystems = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(DISTINCT w.employeeId) AS n
      FROM employee_weekly_schedules w
      JOIN employee_schedule_assignments a ON a.employeeId = w.employeeId
  `;
  console.log(`employees present in BOTH scheduling systems: ${bothSystems[0]?.n ?? 0}`);

  // ── Date round-trip probe (read-only) ──────────────────────────────────────
  heading('11. Date-only round-trip probe (read-only)');
  console.log(`process TZ: ${process.env.TZ ?? '(not set)'}  offsetMinutes: ${new Date().getTimezoneOffset()}`);
  const sample = await prisma.attendanceRecord.findFirst({ select: { date: true } });
  if (sample) {
    const d = sample.date;
    console.log(`sample stored date object: ${d.toString()}`);
    console.log(`  toISOString():            ${d.toISOString()}`);
    console.log(`  toISOString().slice(0,10):${d.toISOString().slice(0, 10)}   <- what current code uses`);
    console.log(`  local getFullYear-Month-Date: ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    const drift = d.toISOString().slice(0, 10) !==
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    console.log(drift ? '  => DRIFT DETECTED between UTC and local extraction' : '  => no drift for this sample');
  } else {
    console.log('no attendance records to sample');
  }

  console.log('\nPreflight complete. No writes were performed.\n');
}

main()
  .catch((e) => {
    console.error('Preflight failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
