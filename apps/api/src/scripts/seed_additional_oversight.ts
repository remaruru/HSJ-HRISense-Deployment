/**
 * Adds the INITIAL additional-oversight relationships from Hospicio's reference,
 * only where every name clearly matches the current HRISense data. After this,
 * HR manages them on the Org Chart (Manage Additional Oversight).
 *
 *   npx tsx src/scripts/seed_additional_oversight.ts
 *
 * Safe to run more than once: an existing relationship is reported and left
 * alone; nothing else is touched. No job role is created or renamed.
 *
 * Rules:
 *   • A reference label is used only when it names a CURRENT job role — exactly,
 *     or as confirmed by HR (e.g. "Receptionist" → Receptionists). Everything
 *     else is reported as needing confirmation, never guessed (Finance Staff is
 *     not assumed to be Accounting Staff; CYWDP Coordinator is not assumed to be
 *     CY Coordinator; …).
 *   • The overseer is an actual employee: the one active employee holding the
 *     named role. If there is not exactly one, nothing is added — HR picks.
 *   • A role whose people already report to the overseer is the primary
 *     hierarchy, not additional oversight, and is skipped (the service refuses it).
 *   • Health Services Sister-in-Charge is not seeded: HR selects which Sister.
 */
import 'dotenv/config';
import { prisma } from '../config/prisma';
import { AdditionalOversightService } from '../services/additional-oversight.service';

/** Reference label → current job role title. Null = not a current role / not confirmed. */
const CONFIRMED_ROLE: Record<string, string | null> = {
  // Exact matches
  'Janitorial Supervisor': 'Janitorial Supervisor',
  'Maintenance Supervisor': 'Maintenance Supervisor',
  'Laundry Staff': 'Laundry Staff',
  'IGP Coordinator': 'IGP Coordinator',
  'Kitchen Supervisor': 'Kitchen Supervisor',
  'PMO Staff': 'PMO Staff',
  'Liaison Officer': 'Liaison Officer',
  'PSN Coordinator': 'PSN Coordinator',
  'CIP Coordinator': 'CIP Coordinator',
  'OP Coordinator': 'OP Coordinator',
  'Chapel Staff': 'Chapel Staff',
  // Confirmed by HR (8 Oct 2026) as the current role
  Receptionist: 'Receptionists',
  'SSD Head': 'Head SSD',
  'Pastoral Care & Homelife Services Head': 'Head Pastoral Care/Homelife Services',
  // Not current roles / need confirmation — never mapped automatically
  'Finance Staff': null,
  'Admin Staff': null,
  'IT Staff': null,
  'HRD Officer': null,
  'CYWDP Coordinator': null,
  'IGP Staff Institutional': null,
};

const REFERENCES: Array<{ reference: string; overseerRole: string; oversees: string[] }> = [
  {
    reference: 'Sister Bambi — Finance Officer (her job role: Sister)',
    overseerRole: 'Sister',
    oversees: ['Finance Staff', 'Janitorial Supervisor', 'Maintenance Supervisor', 'Laundry Staff', 'IGP Coordinator', 'Kitchen Supervisor', 'PMO Staff'],
  },
  {
    // "Administrator" is not a current role; Assistant Administrator is.
    reference: 'Administrator / Assistant Administrator',
    overseerRole: 'Assistant Administrator',
    oversees: ['Receptionist', 'Admin Staff', 'IT Staff', 'Liaison Officer', 'SSD Head', 'HRD Officer', 'Pastoral Care & Homelife Services Head'],
  },
  {
    reference: 'Pastoral Care & Home Life Services Head',
    overseerRole: 'Head Pastoral Care/Homelife Services',
    oversees: ['PSN Coordinator', 'CIP Coordinator', 'CYWDP Coordinator', 'OP Coordinator', 'IGP Staff Institutional', 'Chapel Staff'],
  },
];

async function main() {
  const report: string[] = [];
  for (const ref of REFERENCES) {
    report.push(`\n${ref.reference}`);
    const holders = await prisma.employee.findMany({
      where: { deletedAt: null, jobRole: { title: ref.overseerRole } },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    });
    if (holders.length !== 1) {
      report.push(`  NOT ADDED — ${holders.length} active employees hold "${ref.overseerRole}"; HR must choose the person.`);
      continue;
    }
    const overseer = holders[0];
    report.push(`  overseer: ${`${overseer.firstName} ${overseer.lastName}`.trim()} (${overseer.employeeNumber}, ${ref.overseerRole})`);

    for (const label of ref.oversees) {
      const title = CONFIRMED_ROLE[label];
      if (!title) {
        report.push(`  ? ${label} — not a current HRISense job role; needs confirmation (not added)`);
        continue;
      }
      const role = await prisma.jobRole.findFirst({ where: { title }, select: { id: true } });
      if (!role) {
        report.push(`  ? ${label} — "${title}" not found (not added)`);
        continue;
      }
      try {
        await AdditionalOversightService.add({ overseerId: overseer.id, overseenJobRoleId: role.id }, { id: '' });
        report.push(`  + ${title}`);
      } catch (e: any) {
        report.push(`  - ${title} — ${e.message}`);
      }
    }
  }
  report.push('\nHealth Services Sister-in-Charge → Clinic Staff, PT Coordinator: not added — HR selects which Sister.');
  console.log(report.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
