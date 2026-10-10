/**
 * =============================================================================
 * HRISense — Demo Account Seeder
 * =============================================================================
 *
 * Makes sure every active Job Role has one demo account: a DEV- employee with a
 * user login. Demo accounts are example people for demonstrating HRISense —
 * their names are their job role ("Kitchen Staff"), their details are
 * placeholders, and they never belong to a real person.
 *
 * Credentials:
 *   - Login email: <shortcode>@example.com (see demo-accounts.js for why the
 *     reserved example.com domain is used).
 *   - Password: the value of the DEMO_ACCOUNT_PASSWORD environment variable,
 *     stored only as a bcrypt hash. No password is written in this file, printed,
 *     or saved to a report.
 *
 * Safe to rerun:
 *   - A role that already has a DEV- account → left exactly as it is
 *   - A role without one                    → account created
 *   - --reset-passwords                     → existing demo accounts get the
 *                                             DEMO_ACCOUNT_PASSWORD again (and
 *                                             are unlocked)
 *   - Nothing is ever deleted, and accounts that are not demo accounts are never
 *     touched.
 *
 * The full demo dataset (these accounts plus their example records) is seeded
 * by prisma/demo/seed-demo.js, which also runs this script at the end.
 *
 * Run from the apps/api directory:
 *   node src/scripts/seed_dev_accounts.js
 *   node src/scripts/seed_dev_accounts.js --only SISTER        (one role)
 *   node src/scripts/seed_dev_accounts.js --reset-passwords
 * =============================================================================
 */

'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { getDemoPassword, hashDemoPassword, demoEmail } = require('../../prisma/demo/demo-accounts');

// =============================================================================
// DEMO LOGIN NAMES  (role code → login short code; the domain is example.com)
// =============================================================================
const DEMO_LOGINS = {
  // Human Resource Department
  HR_OFFICER: 'hr',
  HR_ASSISTANT: 'hrassistant',

  // Organisation-wide (FULL tier — same HRISense access as HR)
  SISTER: 'sister',

  // Administrative Services
  ADMINISTRATOR: 'admin',
  ASST_ADMIN: 'assistantadmin',
  ADMIN_SEC: 'adminsecretary',
  RECEPTIONIST: 'receptionist',

  // Health Services
  CLINIC_STAFF: 'clinic',
  PT_COORDINATOR: 'ptcoordinator',
  PT_STAFF: 'ptstaff',

  // Finance
  ACCOUNTING_STAFF: 'accounting',
  LIAISON_OFFICER: 'liaison',
  PMO_STAFF: 'pmo',
  STOCKROOM_STAFF: 'stockroom',

  // General Support Services
  KITCHEN_SUPERVISOR: 'kitchensupervisor',
  KITCHEN_STAFF: 'kitchenstaff',
  JANITORIAL_SUPERVISOR: 'janitorialsupervisor',
  JANITORIAL_STAFF: 'janitorialstaff',
  MAINTENANCE_SUPERVISOR: 'maintenancesupervisor',
  MAINTENANCE_STAFF: 'maintenancestaff',
  LAUNDRY_STAFF: 'laundry',
  DRIVER: 'driver',

  // Pastoral Care / Homelife Services
  HEAD_PCH: 'headpch',
  CHAPEL_STAFF: 'chapel',
  CY_COORDINATOR: 'cy',
  OP_COORDINATOR: 'op',
  PSN_COORDINATOR: 'psn',
  CIP_COORDINATOR: 'cip',
  PRE_SCHOOL_STAFF: 'preschool',
  ST_MARY_STAFF: 'stmary',
  ST_VINCENT_STAFF: 'stvincent',
  ST_JOSEPH_STAFF: 'stjoseph',
  STA_LUISA_STAFF: 'staluisa',
  RENDU_A_STAFF: 'rendua',
  RENDU_B_STAFF: 'rendub',
  RENDU_C_STAFF: 'renduc',
  SIGLIV_BOYS_STAFF: 'siglivboys',
  TAHAN_CENTER_STAFF: 'tahan',
  SANCTUARY_CENTER_STAFF: 'sanctuary',

  // Social Services
  HEAD_SSD: 'headssd',
  SOCIAL_WORKER: 'socialworker',
  PSYCHOLOGIST: 'psychologist',
  PT_PSYCHOLOGIST: 'ptpsychologist',
  ECCD_TEACHER: 'eccd',

  // Auxiliary Services
  IGP_COORDINATOR: 'igp',
  BAKERY_STAFF: 'bakery',
  CANTEEN_STAFF: 'canteen',
  DORMITORY_STAFF: 'dormitory',
};

/** A role added later gets a login from its code: NEW_ROLE → newrole@example.com */
function loginFor(roleCode) {
  return demoEmail(DEMO_LOGINS[roleCode] || roleCode.toLowerCase().replace(/[^a-z0-9]+/g, ''));
}

// =============================================================================
// ROLE-BASED EMPLOYEE NAME  (derive first/last name from job role title)
// =============================================================================
function deriveEmployeeName(roleTitle) {
  const parts = roleTitle.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  // Last word = lastName, everything before = firstName
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  return { firstName, lastName };
}

// =============================================================================
// DETERMINISTIC EMPLOYEE NUMBER  (DEV-<unit>-<seq>; next free number if taken)
// =============================================================================
const ROLE_SEQUENCE = {
  HR_OFFICER: 1, HR_ASSISTANT: 2, SISTER: 3,
  ADMINISTRATOR: 1, ASST_ADMIN: 2, ADMIN_SEC: 3, RECEPTIONIST: 4,
  CLINIC_STAFF: 1, PT_COORDINATOR: 2, PT_STAFF: 3,
  ACCOUNTING_STAFF: 1, LIAISON_OFFICER: 2, PMO_STAFF: 3, STOCKROOM_STAFF: 4,
  KITCHEN_SUPERVISOR: 1, KITCHEN_STAFF: 2,
  JANITORIAL_SUPERVISOR: 3, JANITORIAL_STAFF: 4,
  MAINTENANCE_SUPERVISOR: 5, MAINTENANCE_STAFF: 6,
  LAUNDRY_STAFF: 7, DRIVER: 8,
  HEAD_PCH: 1, CHAPEL_STAFF: 2, CY_COORDINATOR: 3, OP_COORDINATOR: 4,
  PSN_COORDINATOR: 5, CIP_COORDINATOR: 6, PRE_SCHOOL_STAFF: 7,
  ST_MARY_STAFF: 8, ST_VINCENT_STAFF: 9, ST_JOSEPH_STAFF: 10,
  STA_LUISA_STAFF: 11, RENDU_A_STAFF: 12, RENDU_B_STAFF: 13,
  RENDU_C_STAFF: 14, SIGLIV_BOYS_STAFF: 15, TAHAN_CENTER_STAFF: 16,
  SANCTUARY_CENTER_STAFF: 17,
  HEAD_SSD: 1, SOCIAL_WORKER: 2, PSYCHOLOGIST: 3,
  PT_PSYCHOLOGIST: 4, ECCD_TEACHER: 5,
  IGP_COORDINATOR: 1, BAKERY_STAFF: 2, CANTEEN_STAFF: 3, DORMITORY_STAFF: 4,
};

async function freeEmployeeNumber(prisma, unitCode, roleCode) {
  const taken = new Set(
    (await prisma.employee.findMany({
      where: { employeeNumber: { startsWith: `DEV-${unitCode}-` } },
      select: { employeeNumber: true },
    })).map((e) => e.employeeNumber)
  );
  for (let seq = ROLE_SEQUENCE[roleCode] || 99; ; seq++) {
    const candidate = `DEV-${unitCode}-${String(seq).padStart(3, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// =============================================================================
// UNIT FOR ORGANISATION-WIDE ROLES
// =============================================================================
// A role with no unit (e.g. SISTER) can be held in any unit, but an employee
// must have one. The demo account is placed here; HR can move it on the profile.
const ORG_WIDE_ROLE_UNIT = { SISTER: 'HRD' };

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================
/**
 * @param {object}  [options]
 * @param {import('@prisma/client').PrismaClient} [options.prisma] reuse a client (seed-demo.js)
 * @param {string}  [options.only]            one job role code
 * @param {boolean} [options.resetPasswords]  set existing demo accounts back to DEMO_ACCOUNT_PASSWORD
 */
async function seedDevAccounts(options = {}) {
  const prisma = options.prisma || new PrismaClient();
  const ownsClient = !options.prisma;
  const results = { created: [], reset: [], skipped: 0, notPlaced: [] };
  let password = null;
  const demoPassword = () => (password = password || getDemoPassword());

  try {
    const jobRoles = await prisma.jobRole.findMany({
      where: { isActive: true, ...(options.only ? { code: options.only } : {}) },
      include: { unit: true },
      orderBy: [{ code: 'asc' }],
    });
    if (options.only && jobRoles.length === 0) {
      console.error(`No active job role with code ${options.only}.`);
    }

    for (const role of jobRoles) {
      const existing = await prisma.employee.findFirst({
        where: { jobRoleId: role.id, employeeNumber: { startsWith: 'DEV-' }, deletedAt: null },
        include: { user: true },
      });

      if (existing) {
        if (options.resetPasswords && existing.user) {
          await prisma.user.update({
            where: { id: existing.user.id },
            data: {
              passwordHash: await hashDemoPassword(demoPassword()),
              mustChangePassword: false,
              failedLoginAttempts: 0,
              lockedUntil: null,
              isActive: true,
            },
          });
          results.reset.push(existing.user.email);
        } else {
          results.skipped++;
        }
        continue;
      }

      // Organisation-wide roles have no unit of their own; use the configured one.
      let unit = role.unit;
      if (!unit) {
        const fallbackCode = ORG_WIDE_ROLE_UNIT[role.code];
        unit = fallbackCode ? await prisma.unit.findUnique({ where: { code: fallbackCode } }) : null;
        if (!unit) {
          results.notPlaced.push(`${role.code} — ${role.title} (organisation-wide role with no unit configured)`);
          continue;
        }
      }

      // The login must be free; a clash with any other account gets a -demo suffix.
      let email = loginFor(role.code);
      if (await prisma.user.findFirst({ where: { email } })) {
        email = email.replace('@', '-demo@');
      }
      if (await prisma.user.findFirst({ where: { email } })) {
        results.notPlaced.push(`${role.code} — ${role.title} (login ${email} is already used)`);
        continue;
      }

      const employeeNumber = await freeEmployeeNumber(prisma, unit.code, role.code);
      const { firstName, lastName } = deriveEmployeeName(role.title);
      const passwordHash = await hashDemoPassword(demoPassword());
      const mobileIndex = String(results.created.length + 1).padStart(4, '0');

      await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.create({
          data: {
            employeeNumber,
            firstName,
            lastName,
            gender: 'MALE',
            dateOfBirth: new Date('1990-01-15'),
            civilStatus: 'SINGLE',
            mobilePhone: `0917000${mobileIndex}`,
            personalEmail: email,
            presentAddress: '1015 Plaza San Jose, Otaza St, Quiapo, Manila',
            emergencyContactName: 'Emergency Contact',
            emergencyContactRel: 'Family',
            emergencyContactPhone: '09179999999',
            unitId: unit.id,
            departmentId: null,
            jobRoleId: role.id,
            employmentStatus: 'REGULAR',
            employmentState: 'ACTIVE',
            hireDate: new Date('2024-01-01'),
            supervisorAssignmentStatus: 'PENDING',
          },
        });

        await tx.employeeEmergencyContact.create({
          data: { employeeId: emp.id, position: 1, contactName: 'Emergency Contact', relationship: 'Family', mobilePhone: '09179999999' },
        });

        await tx.user.create({
          data: {
            email,
            passwordHash,
            employeeId: emp.id,
            isActive: true,
            mustChangePassword: false,
          },
        });
      });
      results.created.push(`${employeeNumber} — ${role.title} → ${email}`);
    }

    console.log('\nDemo accounts');
    console.log(`  Created:          ${results.created.length}`);
    for (const line of results.created) console.log(`    + ${line}`);
    if (options.resetPasswords) console.log(`  Password reset:   ${results.reset.length}`);
    console.log(`  Already present:  ${results.skipped}`);
    if (results.notPlaced.length) {
      console.log(`  Not created:      ${results.notPlaced.length}`);
      for (const line of results.notPlaced) console.log(`    ! ${line}`);
    }
    if (results.created.length || results.reset.length) {
      console.log('  Password: the value of DEMO_ACCOUNT_PASSWORD (not shown).');
    }
    return results;
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================
if (require.main === module) {
  const onlyIdx = process.argv.indexOf('--only');
  seedDevAccounts({
    only: onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined,
    resetPasswords: process.argv.includes('--reset-passwords'),
  }).catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  });
}

module.exports = { seedDevAccounts, DEMO_LOGINS };
