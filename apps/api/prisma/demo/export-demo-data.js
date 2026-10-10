/**
 * Builds prisma/demo/demo-data.json — the HRISense demo dataset — from a LOCAL
 * development database. Read-only: it never writes to the database.
 *
 * What goes in:
 *   - reference data (units, job roles, permissions, shifts, schedule templates,
 *     holidays, evaluation templates, compliance requirements, voting groups,
 *     system settings, Yearly Achievements sample pages);
 *   - the demo accounts — employees whose number starts with DEV- — and the
 *     records that belong to them (leave, evaluations, schedules, oversight,
 *     calendar notes, announcements, notifications, …).
 * What stays out: any other employee, applicants and their documents, the
 * biometric attendance imports, uploaded files, sessions, password-reset
 * tokens, audit/AI logs, and legacy tables nothing uses. Every model in the
 * schema must be classified below, so a new table is never exported by accident.
 *
 * Sanitising: demo logins move to the example.com domain, password hashes are
 * dropped (the seeder hashes DEMO_ACCOUNT_PASSWORD instead), sign-in history is
 * cleared, and file references are removed (files are not in the repository).
 * The run ends with a privacy check that fails if any excluded person's name or
 * email, or any real-world mail domain, is left in the output.
 *
 * Usage (from apps/api, against the local database):
 *   DATABASE_URL=mysql://root@localhost:3306/hrisense_db node prisma/demo/export-demo-data.js
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const { demoEmail } = require('./demo-accounts');

const OUT = path.join(__dirname, 'demo-data.json');
const DEMO_EMPLOYEE_PREFIX = 'DEV-';

/** Exported whole: organisation set-up and other content with no personal data. */
const REFERENCE = [
  'Department', 'Unit', 'JobRole', 'Permission', 'RolePermission',
  'ShiftDefinition', 'ScheduleTemplate', 'ScheduleTemplateDay',
  'OrganizationCalendarEntry', 'OrganizationCalendarWorkingUnit',
  'EvaluationTemplate', 'EvaluationCriterionGroup', 'EvaluationCriterion', 'EvaluationTemplateJobRole',
  'ComplianceRequirement', 'ComplianceRequirementScope',
  'AwardGroup', 'SystemSetting', 'YearlyAchievementPage', 'YearlyAchievementEntry',
];

/** Exported when every person they point to is a demo account. */
const DEMO_RECORDS = [
  'EmployeeEmergencyContact', 'EmployeeGovernmentId',
  'EmployeeScheduleAssignment', 'EmployeeWeeklySchedule', 'EmployeeWeeklyScheduleDay', 'EmployeeWeeklyScheduleShift',
  'LeaveBalance', 'LeaveRequest',
  'EvaluationCycle', 'EvaluationCycleScope', 'EvaluationAssignment', 'EvaluationResponse',
  'AdditionalOversight', 'CalendarNote', 'CalendarNoteRecipient', 'Notification',
  'MedicalRecord', 'PsychologicalRecord', 'EmployeeComplianceRecord', 'TrainingActivity', 'TrainingParticipant',
  'Award', 'AwardCategory', 'AwardNomination', 'AwardBallot', 'AwardVote', 'AwardResult', 'HallOfFameRecord',
  'Announcement', 'AnnouncementAudienceScope', 'AnnouncementRecipient', 'JobOpening',
];

/** Never exported. */
const EXCLUDED = {
  UserSession: 'sign-in sessions (refresh tokens)',
  PasswordResetToken: 'secret tokens',
  EmailVerificationToken: 'secret tokens',
  AuditLog: 'history of the local database, including non-demo people and addresses',
  ActivityLog: 'history',
  ScheduleHistoryLog: 'history',
  AIConversation: 'AI chat history', AIInsight: 'AI output', AIRequestLog: 'AI request log',
  AttendanceRecord: 'belongs to non-demo employees',
  AttendanceLog: 'belongs to non-demo employees',
  AttendanceImportBatch: 'a real biometric export', AttendanceImportRawRow: 'a real biometric export',
  AttendanceImportCandidate: 'a real biometric export',
  Applicant: 'real applicants', JobApplication: 'real applicants', ApplicantDocument: 'real applicants',
  ApplicantInterview: 'real applicants', ApplicationStatusHistory: 'real applicants', ApplicantNote: 'real applicants',
  ApplicantCommunication: 'real applicants', OnboardingDraft: 'typed during onboarding tests',
  EmployeeDocument: 'uploaded files are not in the repository',
  MedicalRecordDocument: 'uploaded files', PsychologicalRecordDocument: 'uploaded files',
  EmployeeComplianceDocument: 'uploaded files', TrainingActivityDocument: 'uploaded files',
  AnnouncementAttachment: 'uploaded files', UploadedFile: 'uploaded files',
  Payslip: 'legacy, unused', SupervisionLink: 'legacy, unused', Training: 'legacy, unused',
  TrainingAttendee: 'legacy, unused', ActivityAttendance: 'legacy, unused', PerformanceEvaluation: 'legacy, unused',
  LegacyComplianceRequirement: 'legacy, unused', LegacyComplianceDocument: 'legacy, unused',
  LegacyMedicalRecord: 'legacy, unused', LegacyPsychologicalRecord: 'legacy, unused',
};

/**
 * Optional links that define what a row is *about*: if the target is not
 * exported, the row is dropped rather than left pointing at nobody.
 */
const DROP_WHEN_TARGET_MISSING = new Set([
  'EvaluationCycleScope.targetEmployeeId',
  'AnnouncementAudienceScope.targetEmployeeId',
  'ComplianceRequirementScope.targetEmployeeId',
  'AdditionalOversight.overseenEmployeeId',
  'AwardResult.categoryId',
]);

/** References to stored files — cleared, because the files are not shipped. */
const FILE_FIELDS = {
  Employee: ['photoUrl'],
  LeaveRequest: ['supportingDocUrl'],
  YearlyAchievementEntry: ['attachmentPath', 'attachmentName', 'attachmentMime'],
  TrainingParticipant: ['certificateOriginalFilename', 'certificateStoredFilename', 'certificateMimeType'],
};

const prisma = new PrismaClient();
const models = Prisma.dmmf.datamodel.models;
const modelByName = Object.fromEntries(models.map((m) => [m.name, m]));
const delegate = (name) => prisma[name[0].toLowerCase() + name.slice(1)];

/** Required and optional foreign keys of a model, from the schema. */
function foreignKeys(model) {
  const out = [];
  for (const f of model.fields) {
    if (f.kind === 'object' && f.relationFromFields && f.relationFromFields.length === 1) {
      out.push({ field: f.relationFromFields[0], target: f.type, required: f.isRequired });
    }
  }
  return out;
}

/** Insert order: every model after the models its required foreign keys point to. */
function insertionOrder(names) {
  const set = new Set(names);
  const done = [];
  const pending = [...names];
  while (pending.length) {
    const i = pending.findIndex((n) =>
      foreignKeys(modelByName[n]).every((fk) => !fk.required || fk.target === n || !set.has(fk.target) || done.includes(fk.target))
    );
    if (i === -1) throw new Error(`Circular required references among: ${pending.join(', ')}`);
    done.push(pending.splice(i, 1)[0]);
  }
  return done;
}

async function main() {
  const classified = new Set([...REFERENCE, ...DEMO_RECORDS, 'Employee', 'User', ...Object.keys(EXCLUDED)]);
  const unclassified = models.map((m) => m.name).filter((n) => !classified.has(n));
  if (unclassified.length) {
    throw new Error(`Classify these models in export-demo-data.js before exporting: ${unclassified.join(', ')}`);
  }

  const included = [...REFERENCE, 'Employee', 'User', ...DEMO_RECORDS];
  const rows = {};
  for (const name of REFERENCE) rows[name] = await delegate(name).findMany();
  for (const name of DEMO_RECORDS) rows[name] = await delegate(name).findMany();
  rows.Employee = await prisma.employee.findMany({
    where: { employeeNumber: { startsWith: DEMO_EMPLOYEE_PREFIX }, deletedAt: null },
  });
  const demoEmployeeIds = new Set(rows.Employee.map((e) => e.id));
  rows.User = (await prisma.user.findMany({ where: { deletedAt: null } })).filter((u) => demoEmployeeIds.has(u.employeeId));

  // People who are NOT exported: their ids must not survive anywhere.
  const allEmployees = await prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true, personalEmail: true, workEmail: true } });
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, employeeId: true } });
  const excludedPeople = new Set([
    ...allEmployees.filter((e) => !demoEmployeeIds.has(e.id)).map((e) => e.id),
    ...allUsers.filter((u) => !demoEmployeeIds.has(u.employeeId)).map((u) => u.id),
  ]);

  // Drop or detach rows that point at anything not exported, until nothing changes.
  const report = { dropped: {}, nulled: {} };
  const bump = (bucket, key) => { report[bucket][key] = (report[bucket][key] || 0) + 1; };
  for (let changed = true; changed; ) {
    changed = false;
    const ids = Object.fromEntries(included.map((n) => [n, new Set(rows[n].map((r) => r.id))]));
    for (const name of included) {
      const fks = foreignKeys(modelByName[name]);
      const kept = [];
      for (const row of rows[name]) {
        let drop = false;
        for (const fk of fks) {
          const v = row[fk.field];
          if (v == null) continue;
          const exists = ids[fk.target] ? ids[fk.target].has(v) : false;
          if (exists) continue;
          if (fk.required || DROP_WHEN_TARGET_MISSING.has(`${name}.${fk.field}`)) {
            drop = true;
            bump('dropped', `${name} (${fk.field} → ${fk.target} not exported)`);
            break;
          }
          row[fk.field] = null;
          bump('nulled', `${name}.${fk.field}`);
        }
        if (drop) changed = true;
        else kept.push(row);
      }
      rows[name] = kept;
    }
  }

  // Plain-text references (not formal relations) to people who are not exported.
  for (const name of included) {
    const model = modelByName[name];
    const stringFields = model.fields.filter((f) => f.kind === 'scalar' && f.type === 'String' && !f.isId && !f.isRequired);
    for (const row of rows[name]) {
      for (const f of stringFields) {
        if (row[f.name] && excludedPeople.has(row[f.name])) {
          row[f.name] = null;
          bump('nulled', `${name}.${f.name} (reference to a non-demo person)`);
        }
      }
    }
  }

  // Sanitise.
  for (const [name, fields] of Object.entries(FILE_FIELDS)) {
    for (const row of rows[name] || []) for (const f of fields) row[f] = null;
  }
  for (const e of rows.Employee) {
    if (e.personalEmail) e.personalEmail = demoEmail(e.personalEmail);
    if (e.workEmail) e.workEmail = demoEmail(e.workEmail);
  }
  for (const u of rows.User) {
    u.email = demoEmail(u.email);
    u.passwordHash = null; // set by the seeder from DEMO_ACCOUNT_PASSWORD
    u.failedLoginAttempts = 0;
    u.lockedUntil = null;
    u.lastLoginAt = null;
    u.lastLoginIp = null;
    u.mustChangePassword = false;
  }

  const order = insertionOrder(included);
  const data = {
    format: 'hrisense-demo-data/1',
    generatedAt: new Date().toISOString(),
    description:
      'Synthetic HRISense demo data: reference data, the DEV- demo accounts and their example records. ' +
      'Contains no password hashes; the seeder sets DEMO_ACCOUNT_PASSWORD.',
    models: order.map((name) => ({ model: name, rows: rows[name] })),
  };
  const json = JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n';

  // Privacy check: nothing about the people who were left out may remain.
  const lower = json.toLowerCase();
  const needles = new Set();
  for (const e of allEmployees.filter((x) => !demoEmployeeIds.has(x.id))) {
    if (e.firstName && e.lastName) needles.add(`${e.firstName} ${e.lastName}`.toLowerCase());
    for (const m of [e.personalEmail, e.workEmail]) if (m) needles.add(m.toLowerCase());
  }
  for (const u of allUsers.filter((x) => !demoEmployeeIds.has(x.employeeId))) needles.add(u.email.toLowerCase());
  for (const a of await prisma.applicant.findMany({ select: { firstName: true, lastName: true, email: true } })) {
    needles.add(`${a.firstName} ${a.lastName}`.toLowerCase());
    if (a.email) needles.add(a.email.toLowerCase());
  }
  for (const id of excludedPeople) needles.add(id.toLowerCase());
  const leaks = [...needles].filter((n) => n.trim().length > 3 && lower.includes(n));
  const domains = ['@gmail.com', '@yahoo.', '@outlook.', '@hotmail.', 'tip.edu.ph', '@hsj.org.ph'].filter((d) => lower.includes(d));
  if (leaks.length || domains.length) {
    throw new Error(`Privacy check failed — ${leaks.length} excluded name/email/id value(s) and these domains remain: ${domains.join(', ') || 'none'}. Nothing was written.`);
  }

  fs.writeFileSync(OUT, json, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
  for (const m of data.models) if (m.rows.length) console.log(`  ${m.model.padEnd(32)} ${m.rows.length}`);
  for (const [bucket, entries] of Object.entries(report)) {
    for (const [k, n] of Object.entries(entries)) console.log(`  ${bucket.padEnd(7)} ${n} × ${k}`);
  }
  console.log('Privacy check passed.');
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
