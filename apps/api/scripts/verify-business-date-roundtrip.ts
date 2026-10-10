/**
 * Proves date-only values survive the full round trip without shifting a day.
 *
 * Run with:  npx tsx scripts/verify-business-date-roundtrip.ts
 *
 * SAFETY: writes ONLY to the migration/development database, never to
 * `hrisense_db`. It creates a temporary row, reads it back, and deletes it. If
 * `SHADOW_DATABASE_URL` is not configured it runs the pure-function checks only
 * and reports the DB round-trip as SKIPPED rather than touching the main data.
 */
import { PrismaClient } from '@prisma/client';
import {
  toBusinessDate,
  businessDateKey,
  instantToBusinessDate,
  businessDaysBetweenInclusive,
  isSameBusinessDate,
  formatBusinessDate,
} from '../src/lib/businessDate';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        got=${actual}  expected=${expected}`);
}

async function main() {
  console.log(`server TZ offset: ${new Date().getTimezoneOffset()} minutes (negative = east of UTC)`);
  console.log(`process.env.TZ  : ${process.env.TZ ?? '(not set)'}\n`);

  console.log('── Pure function checks ─────────────────────────────────────');

  check('YYYY-MM-DD stays itself', businessDateKey('2026-09-05'), '2026-09-05');
  check('leap day', businessDateKey('2028-02-29'), '2028-02-29');
  check('year boundary', businessDateKey('2026-12-31'), '2026-12-31');
  check('new year', businessDateKey('2027-01-01'), '2027-01-01');

  // The classic failure: a Date built from a local-midnight string.
  const localMidnight = new Date('2026-09-05T00:00:00');
  check('local-midnight Date normalises correctly', businessDateKey(localMidnight), '2026-09-05');

  // A value shaped like what Prisma returns for @db.Date.
  const prismaShaped = new Date(Date.UTC(2026, 8, 5));
  check('UTC-midnight Date (Prisma @db.Date shape)', businessDateKey(prismaShaped), '2026-09-05');

  // Instants either side of Manila midnight.
  check(
    'instant 23:30 Manila on 5 Sep -> 2026-09-05',
    businessDateKey(instantToBusinessDate(new Date('2026-09-05T15:30:00.000Z'))),
    '2026-09-05'
  );
  check(
    'instant 00:30 Manila on 6 Sep -> 2026-09-06',
    businessDateKey(instantToBusinessDate(new Date('2026-09-05T16:30:00.000Z'))),
    '2026-09-06'
  );

  check('inclusive day span 1..30 Sep', businessDaysBetweenInclusive('2026-09-01', '2026-09-30'), 30);
  check('same day span', businessDaysBetweenInclusive('2026-09-05', '2026-09-05'), 1);
  check('isSameBusinessDate across representations', isSameBusinessDate('2026-09-05', prismaShaped), 'true');
  check('human format', formatBusinessDate('2026-09-05'), '5 September 2026');

  // Every day of a month must round-trip.
  let monthDrift = 0;
  for (let d = 1; d <= 30; d++) {
    const key = `2026-09-${String(d).padStart(2, '0')}`;
    if (businessDateKey(toBusinessDate(key)) !== key) monthDrift++;
  }
  check('all 30 days of September round-trip', monthDrift, 0);

  // ── Database round trip, migration DB only ────────────────────────────────
  console.log('\n── Database round trip ──────────────────────────────────────');
  const shadowUrl = process.env.SHADOW_DATABASE_URL;
  if (!shadowUrl) {
    console.log('SKIPPED — SHADOW_DATABASE_URL is not set.');
    console.log('         Refusing to write to hrisense_db to test this.');
    console.log('         The read-only probe in preflight-integrity-check.ts already');
    console.log('         confirmed stored @db.Date values return as UTC midnight.');
  } else {
    const prisma = new PrismaClient({ datasources: { db: { url: shadowUrl } } });
    try {
      const employee = await prisma.employee.findFirst({ select: { id: true } });
      if (!employee) {
        console.log('SKIPPED — migration database has no employee rows to attach a test record to.');
      } else {
        const probeDate = toBusinessDate('2026-09-05');
        const created = await prisma.attendanceRecord.create({
          data: { employeeId: employee.id, date: probeDate, status: 'PRESENT' },
          select: { id: true, date: true },
        });
        const readBack = await prisma.attendanceRecord.findUnique({
          where: { id: created.id },
          select: { date: true },
        });
        check('DB round trip 2026-09-05', businessDateKey(readBack!.date), '2026-09-05');
        await prisma.attendanceRecord.delete({ where: { id: created.id } });
        console.log('        temporary probe row deleted');
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
