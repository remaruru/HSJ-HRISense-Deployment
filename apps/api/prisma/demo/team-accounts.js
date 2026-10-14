/**
 * The HRISense team's own HR accounts on the hosted site.
 *
 * Names and emails are the team list already shown on the public landing page.
 * Passwords are NOT in this repository: they come from the TEAM_ACCOUNT_PASSWORDS
 * environment variable, set in the host's settings — JSON mapping each email to
 * its password, e.g. {"name@tip.edu.ph": "…"} — checked against the HRISense
 * password rules and stored only as bcrypt hashes.
 *
 * Safe to rerun: an email that already has an account is left exactly as it is
 * (its password is never reset), so this only ever creates missing accounts.
 * Without the variable it does nothing. Called by seed-demo.js after the demo
 * accounts.
 */
'use strict';

const { hashDemoPassword, isValidPassword, PASSWORD_RULE } = require('./demo-accounts');

const PASSWORDS_ENV = 'TEAM_ACCOUNT_PASSWORDS';
const ROLE_CODE = 'HR_OFFICER';

/** Gender, birth date, address and contacts are placeholders the person corrects on their record. */
const TEAM_HR_ACCOUNTS = [
  { firstName: 'Earl Angelo', lastName: 'Roldan', email: 'mearoldan@tip.edu.ph' },
  { firstName: 'Enzo Benedict', lastName: 'Rosales', email: 'mebrosales@tip.edu.ph' },
  { firstName: 'Maria Cielo', lastName: 'Salazar', email: 'mmcsalazar02@tip.edu.ph' },
];

function readPasswords() {
  const raw = process.env[PASSWORDS_ENV];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // reported below
  }
  throw new Error(`${PASSWORDS_ENV} must be JSON mapping each email to its password, like {"name@tip.edu.ph": "…"}.`);
}

/** TEAM-<unit>-001, -002 … — the next number not yet used. */
async function freeTeamNumber(prisma, unitCode) {
  const taken = new Set(
    (await prisma.employee.findMany({
      where: { employeeNumber: { startsWith: `TEAM-${unitCode}-` } },
      select: { employeeNumber: true },
    })).map((e) => e.employeeNumber)
  );
  for (let seq = 1; ; seq++) {
    const candidate = `TEAM-${unitCode}-${String(seq).padStart(3, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
}

async function seedTeamAccounts({ prisma }) {
  const passwords = readPasswords();
  if (!passwords) {
    console.log(`\nTeam HR accounts: skipped (${PASSWORDS_ENV} is not set).`);
    return;
  }

  const role = await prisma.jobRole.findUnique({ where: { code: ROLE_CODE }, include: { unit: true } });
  if (!role || !role.unit) {
    console.warn(`\nTeam HR accounts: skipped (job role ${ROLE_CODE} or its unit is missing).`);
    return;
  }

  const created = [];
  const present = [];
  const problems = [];

  for (const person of TEAM_HR_ACCOUNTS) {
    const email = person.email.toLowerCase();
    const taken =
      (await prisma.user.findFirst({ where: { email } })) ||
      (await prisma.employee.findFirst({ where: { personalEmail: email, deletedAt: null } }));
    if (taken) {
      present.push(email);
      continue;
    }

    const password = passwords[email] ?? passwords[person.email];
    if (!password) {
      problems.push(`${email}: no password in ${PASSWORDS_ENV}`);
      continue;
    }
    if (!isValidPassword(password)) {
      problems.push(`${email}: password does not meet the rules (${PASSWORD_RULE})`);
      continue;
    }

    const employeeNumber = await freeTeamNumber(prisma, role.unit.code);
    const passwordHash = await hashDemoPassword(password);
    await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeNumber,
          firstName: person.firstName,
          lastName: person.lastName,
          gender: 'PREFER_NOT_TO_SAY',
          dateOfBirth: new Date('2000-01-01'),
          civilStatus: 'SINGLE',
          mobilePhone: '09170000000',
          personalEmail: email,
          presentAddress: '1015 Plaza San Jose, Otaza St, Quiapo, Manila',
          emergencyContactName: 'Emergency Contact',
          emergencyContactRel: 'Family',
          emergencyContactPhone: '09179999999',
          unitId: role.unit.id,
          departmentId: null,
          jobRoleId: role.id,
          employmentStatus: 'REGULAR',
          employmentState: 'ACTIVE',
          hireDate: new Date('2026-01-01'),
          supervisorAssignmentStatus: 'PENDING',
        },
      });
      await tx.employeeEmergencyContact.create({
        data: { employeeId: emp.id, position: 1, contactName: 'Emergency Contact', relationship: 'Family', mobilePhone: '09179999999' },
      });
      await tx.user.create({
        data: { email, passwordHash, employeeId: emp.id, isActive: true, mustChangePassword: false },
      });
    });
    created.push(`${employeeNumber} — ${role.title} → ${email}`);
  }

  console.log('\nTeam HR accounts');
  console.log(`  Created:          ${created.length}`);
  for (const line of created) console.log(`    + ${line}`);
  console.log(`  Already present:  ${present.length}`);
  for (const line of problems) console.warn(`  ! ${line}`);
}

module.exports = { seedTeamAccounts, TEAM_HR_ACCOUNTS, PASSWORDS_ENV };
