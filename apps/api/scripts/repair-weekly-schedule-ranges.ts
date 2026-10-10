/**
 * Deterministic repair of the weekly-schedule effective timeline.
 *
 * Run with:  npx tsx scripts/repair-weekly-schedule-ranges.ts          (dry run)
 *            npx tsx scripts/repair-weekly-schedule-ranges.ts --apply  (writes)
 *
 * WHY THIS EXISTS
 * `WeeklyScheduleService.saveEmployeeWeeklySchedule` computed the correct
 * `effectiveTo` for a newly inserted schedule and then discarded it, always
 * writing `effectiveTo: null`. Inserting a schedule before an existing later one
 * therefore left two rows both claiming to cover the same dates. The service bug
 * is fixed; this script restores the timeline for rows written while it existed.
 *
 * THE RULE (not a policy invention — it restores the intended half-open timeline)
 *   For each employee, ordered by effectiveFrom ascending:
 *     schedule[i].effectiveTo = schedule[i+1].effectiveFrom
 *     last schedule.effectiveTo = null
 *
 * SAFETY
 *  • Employees holding two schedules with the SAME effectiveFrom are skipped and
 *    reported as MANUAL DATA RECONCILIATION REQUIRED. Choosing between them would
 *    be arbitrary, so the script refuses.
 *  • Dry run by default. Nothing is written without --apply.
 *  • Only `effectiveTo` is ever written. No row is created or deleted.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function ymd(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : 'OPEN';
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (writes effectiveTo)' : 'MODE: DRY RUN (no writes)');

  const all = await prisma.employeeWeeklySchedule.findMany({
    select: { id: true, employeeId: true, effectiveFrom: true, effectiveTo: true },
    orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'asc' }],
  });

  const byEmployee = new Map<string, typeof all>();
  for (const row of all) {
    const list = byEmployee.get(row.employeeId) ?? [];
    list.push(row);
    byEmployee.set(row.employeeId, list);
  }

  const planned: Array<{ id: string; employeeId: string; from: Date; oldTo: Date | null; newTo: Date | null }> = [];
  const ambiguous: string[] = [];

  for (const [employeeId, rows] of byEmployee) {
    // Refuse to guess when two schedules share an effective date.
    const seen = new Set<string>();
    let hasDuplicateStart = false;
    for (const r of rows) {
      const key = ymd(r.effectiveFrom);
      if (seen.has(key)) hasDuplicateStart = true;
      seen.add(key);
    }
    if (hasDuplicateStart) {
      ambiguous.push(employeeId);
      continue;
    }

    for (let i = 0; i < rows.length; i++) {
      const expectedTo = i < rows.length - 1 ? rows[i + 1].effectiveFrom : null;
      const currentTo = rows[i].effectiveTo;
      const differs =
        (expectedTo === null) !== (currentTo === null) ||
        (expectedTo !== null && currentTo !== null && expectedTo.getTime() !== currentTo.getTime());
      if (differs) {
        planned.push({
          id: rows[i].id,
          employeeId,
          from: rows[i].effectiveFrom,
          oldTo: currentTo,
          newTo: expectedTo,
        });
      }
    }
  }

  console.log(`\nemployees examined: ${byEmployee.size}`);
  console.log(`schedule rows examined: ${all.length}`);
  console.log(`rows needing repair: ${planned.length}`);

  for (const p of planned) {
    console.log(`  employee=${p.employeeId} from=${ymd(p.from)}  ${ymd(p.oldTo)} -> ${ymd(p.newTo)}`);
  }

  if (ambiguous.length > 0) {
    console.log(`\nMANUAL DATA RECONCILIATION REQUIRED — ${ambiguous.length} employee(s) have two schedules sharing one effective date:`);
    for (const e of ambiguous) console.log(`  employee=${e}`);
    console.log('  These were SKIPPED. Do not delete either row automatically.');
  } else {
    console.log('\nNo ambiguous same-effective-date schedules. Nothing skipped.');
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write these changes.');
    return;
  }

  if (planned.length === 0) {
    console.log('\nNothing to apply.');
    return;
  }

  await prisma.$transaction(
    planned.map((p) =>
      prisma.employeeWeeklySchedule.update({
        where: { id: p.id },
        data: { effectiveTo: p.newTo },
      })
    )
  );
  console.log(`\nApplied ${planned.length} effectiveTo correction(s).`);
}

main()
  .catch((e) => {
    console.error('Repair failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
