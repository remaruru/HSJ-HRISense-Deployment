const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { DEMO_EMAIL_DOMAIN } = require('../../prisma/demo/demo-accounts');

// Local development tool: it renames demo logins, which would break the logins a
// hosted demo documents (prisma/demo/README.md).
if (process.env.NODE_ENV === 'production') {
  console.error('[BLOCKED] update_seeded_dev_accounts.js is a local development tool. NODE_ENV is production.');
  process.exit(1);
}

const prisma = new PrismaClient();

// Exact Role Name splitting logic
function getExactRoleName(title) {
  const words = title.trim().split(/\s+/);
  if (words.length === 1) {
    return { firstName: words[0], lastName: '' };
  }
  const lastName = words[words.length - 1];
  const firstName = words.slice(0, words.length - 1).join(' ');
  return { firstName, lastName };
}

async function resolveUniqueGmail(baseCode, unitCode, currentEmpId, currentUserId) {
  let targetEmail = `${baseCode}@${DEMO_EMAIL_DOMAIN}`;

  const isAvailable = async (email) => {
    const existingUser = await prisma.user.findFirst({
      where: { email, NOT: currentUserId ? { id: currentUserId } : undefined }
    });
    const existingEmp = await prisma.employee.findFirst({
      where: { workEmail: email, NOT: { id: currentEmpId } }
    });
    return !existingUser && !existingEmp;
  };

  if (await isAvailable(targetEmail)) {
    return { email: targetEmail, conflict: false };
  }

  // Conflict 1: Unit suffix e.g. clinic-staff-hlt@example.com
  const unitSuffixEmail = `${baseCode}-${unitCode.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`;
  if (await isAvailable(unitSuffixEmail)) {
    return { email: unitSuffixEmail, conflict: true, suffixUsed: `-${unitCode.toLowerCase()}` };
  }

  // Conflict 2: Numeric suffix e.g. clinic-staff-hlt-02@example.com
  for (let num = 2; num <= 99; num++) {
    const numSuffixEmail = `${baseCode}-${unitCode.toLowerCase()}-${String(num).padStart(2, '0')}@${DEMO_EMAIL_DOMAIN}`;
    if (await isAvailable(numSuffixEmail)) {
      return { email: numSuffixEmail, conflict: true, suffixUsed: `-${unitCode.toLowerCase()}-${String(num).padStart(2, '0')}` };
    }
  }

  throw new Error(`Unable to resolve unique Gmail for ${baseCode}`);
}

async function updateSeededDevAccounts() {
  console.log('=== STARTING IDEMPOTENT SEEDED ACCOUNT NAME & SECURITY STANDARDIZATION ===');

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    include: { user: true, unit: true, jobRole: true }
  });

  const updateSummary = {
    totalInspected: employees.length,
    seededInspected: 0,
    accountsUpdated: 0,
    accountsSkippedAlreadyCorrect: 0,
    nonSeededSkipped: 0,
    emailConflicts: [],
    updatedRecords: []
  };

  for (const emp of employees) {
    // Confident identification of seeded account: DEV- prefix OR @hrisense.local email OR @gmail.com seeded role
    const isSeeded = emp.employeeNumber.startsWith('DEV-') ||
      (emp.workEmail && emp.workEmail.endsWith('@hrisense.local')) ||
      (emp.user && emp.user.email && emp.user.email.endsWith('@hrisense.local'));

    if (!isSeeded) {
      updateSummary.nonSeededSkipped++;
      continue;
    }

    updateSummary.seededInspected++;

    const roleTitle = emp.jobRole?.title || 'Staff';
    const roleCode = emp.jobRole?.code || 'ROLE';
    const normalizedRoleCode = roleCode.toLowerCase().replace(/_/g, '-');
    const unitCode = emp.unit?.code || 'GEN';

    // 1. Exact role-based name
    const { firstName: targetFirst, lastName: targetLast } = getExactRoleName(roleTitle);

    // 2. Email resolution with conflict handling
    const emailResult = await resolveUniqueGmail(normalizedRoleCode, unitCode, emp.id, emp.user?.id);
    const targetEmail = emailResult.email;

    if (emailResult.conflict) {
      updateSummary.emailConflicts.push({
        employeeNumber: emp.employeeNumber,
        baseEmail: `${normalizedRoleCode}@${DEMO_EMAIL_DOMAIN}`,
        resolvedEmail: targetEmail,
        suffixUsed: emailResult.suffixUsed
      });
    }

    // Check if already correct
    const isNameCorrect = emp.firstName === targetFirst && emp.lastName === targetLast;
    const isEmailCorrect = emp.workEmail === targetEmail && emp.user?.email === targetEmail;

    if (isNameCorrect && isEmailCorrect) {
      updateSummary.accountsSkippedAlreadyCorrect++;
      continue;
    }

    // Perform atomic transaction update
    const previousFirst = emp.firstName;
    const previousLast = emp.lastName;
    const previousEmail = emp.workEmail || emp.user?.email || 'N/A';

    await prisma.$transaction(async (tx) => {
      // Update Employee
      await tx.employee.update({
        where: { id: emp.id },
        data: {
          firstName: targetFirst,
          lastName: targetLast,
          workEmail: targetEmail,
        }
      });

      // Update User if linked
      if (emp.user) {
        await tx.user.update({
          where: { id: emp.user.id },
          data: {
            email: targetEmail,
          }
        });
      }

      // Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          action: 'DEVELOPMENT_ACCOUNT_STANDARDIZED',
          entityType: 'EMPLOYEE',
          entityId: emp.id,
          actorUserId: emp.user?.id || 'SYSTEM_SEED',
          metadata: {
            employeeId: emp.id,
            employeeNumber: emp.employeeNumber,
            jobRoleId: emp.jobRoleId,
            jobRoleName: roleTitle,
            previousFirstName: previousFirst,
            previousLastName: previousLast,
            newFirstName: targetFirst,
            newLastName: targetLast,
            previousLoginEmail: previousEmail,
            newLoginEmail: targetEmail,
            reason: 'ROLE_NAME_EXACT_MATCH_AND_GMAIL_STANDARDIZATION',
            timestamp: new Date().toISOString(),
          }
        }
      });
    });

    updateSummary.accountsUpdated++;
    updateSummary.updatedRecords.push({
      employeeNumber: emp.employeeNumber,
      jobRole: roleTitle,
      unit: emp.unit?.name,
      previousName: `${previousFirst} ${previousLast}`.trim(),
      newName: `${targetFirst} ${targetLast}`.trim(),
      previousEmail: previousEmail,
      newEmail: targetEmail,
    });
  }

  // Update safe local credentials report in .local/ directory
  const localDir = path.join(__dirname, '../../../../.local');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const reportTxtPath = path.join(localDir, 'dev_credentials_report.txt');
  const reportJsonPath = path.join(localDir, 'dev_credentials_report.json');

  const allSeededEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employeeNumber: { startsWith: 'DEV-' } },
        { workEmail: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } }
      ],
      deletedAt: null
    },
    include: { user: true, unit: true, jobRole: true }
  });

  const reportData = allSeededEmployees.map(e => ({
    employeeNumber: e.employeeNumber,
    name: `${e.firstName} ${e.lastName}`.trim(),
    unit: e.unit?.name,
    jobRole: e.jobRole?.title,
    permissionTier: e.jobRole?.permissionTier,
    loginEmail: e.user?.email || e.workEmail,
    supervisorStatus: e.supervisorAssignmentStatus || 'PENDING'
  }));

  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2));

  const txtLines = [
    '========================================================================',
    '       HRISENSE — DEVELOPMENT DEMO ACCOUNTS CREDENTIAL REPORT          ',
    '========================================================================',
    `Updated At: ${new Date().toISOString()}`,
    `Total Seeded Accounts: ${allSeededEmployees.length}`,
    '------------------------------------------------------------------------',
    ''
  ];

  reportData.forEach((r, idx) => {
    txtLines.push(`${idx + 1}. [${r.employeeNumber}] ${r.name}`);
    txtLines.push(`   Unit: ${r.unit}`);
    txtLines.push(`   Job Role: ${r.jobRole} (Tier: ${r.permissionTier})`);
    txtLines.push(`   Login Email: ${r.loginEmail}`);
    txtLines.push(`   Supervisor Status: ${r.supervisorStatus}`);
    txtLines.push('------------------------------------------------------------------------');
  });

  fs.writeFileSync(reportTxtPath, txtLines.join('\n'));

  console.log('\n=== SEEDED ACCOUNT STANDARDIZATION COMPLETE ===');
  console.log(`Seeded Accounts Inspected: ${updateSummary.seededInspected}`);
  console.log(`Accounts Updated: ${updateSummary.accountsUpdated}`);
  console.log(`Accounts Already Correct (Skipped): ${updateSummary.accountsSkippedAlreadyCorrect}`);
  console.log(`Non-Seeded Accounts Skipped: ${updateSummary.nonSeededSkipped}`);
  console.log(`Email Conflicts Resolved: ${updateSummary.emailConflicts.length}`);
  console.log(`Safe Local Credential Report Location: ${reportTxtPath}`);

  await prisma.$disconnect();
  return updateSummary;
}

if (require.main === module) {
  updateSeededDevAccounts().catch(console.error);
}

module.exports = { updateSeededDevAccounts, getExactRoleName };
