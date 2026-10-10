/**
 * How HR reads the audit trail.
 *
 * Every action name the code writes (`createAuditLog` call sites, plus the
 * schedule and holiday history in `schedule_history_logs`) is mapped here to:
 *   - a module, and the Audit Logs tab that module sits under;
 *   - an action type (Create, Update, Approve, …) for the Action Type filter;
 *   - a plain sentence, e.g. "approved the leave request of {s}".
 *
 * Pure — no database — so the mapping is unit-tested, and the list endpoint can
 * turn a tab or a filter into the exact action names it covers. An action this
 * file does not know still gets a module from its prefix or record type and an
 * honest "performed …" sentence, so a new event is never hidden.
 *
 * Sign-ins, sessions, passwords, account access and record views belong to the
 * Security & Authentication tab and are kept out of All Changes.
 */

export type AuditTab =
  | 'EMPLOYEES'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'EVALUATIONS'
  | 'COMPLIANCE'
  | 'RECRUITMENT'
  | 'COMMUNICATION'
  | 'AWARDS'
  | 'SYSTEM'
  | 'SECURITY';

/** Tab order on the page. "All Changes" is every tab except SECURITY. */
export const AUDIT_TABS: Array<{ id: AuditTab; label: string }> = [
  { id: 'EMPLOYEES', label: 'Employees' },
  { id: 'ATTENDANCE', label: 'Attendance & Schedules' },
  { id: 'LEAVE', label: 'Leave' },
  { id: 'EVALUATIONS', label: 'Evaluations' },
  { id: 'COMPLIANCE', label: 'Training & Compliance' },
  { id: 'RECRUITMENT', label: 'Recruitment' },
  { id: 'COMMUNICATION', label: 'Announcements & Communication' },
  { id: 'AWARDS', label: 'Awards & Achievements' },
  { id: 'SYSTEM', label: 'System & Settings' },
  { id: 'SECURITY', label: 'Security & Authentication' },
];

export type AuditModule =
  | 'EMPLOYEE_RECORDS'
  | 'EMPLOYEE_DOCUMENTS'
  | 'ORGANIZATION'
  | 'ONBOARDING'
  | 'ATTENDANCE'
  | 'SCHEDULES'
  | 'LEAVE_REQUESTS'
  | 'LEAVE_BALANCES'
  | 'EVALUATIONS'
  | 'EVALUATION_FORMS'
  | 'TRAINING'
  | 'COMPLIANCE'
  | 'MEDICAL'
  | 'JOB_OPENINGS'
  | 'APPLICANTS'
  | 'ANNOUNCEMENTS'
  | 'CALENDAR_NOTES'
  | 'AWARDS'
  | 'ACHIEVEMENTS'
  | 'MAINTENANCE'
  | 'OTHER'
  | 'SIGN_IN'
  | 'ACCOUNTS'
  | 'RECORD_ACCESS';

export const AUDIT_MODULES: Record<AuditModule, { label: string; tab: AuditTab }> = {
  EMPLOYEE_RECORDS: { label: 'Employee records', tab: 'EMPLOYEES' },
  EMPLOYEE_DOCUMENTS: { label: 'Employee documents', tab: 'EMPLOYEES' },
  ORGANIZATION: { label: 'Organisation & supervisors', tab: 'EMPLOYEES' },
  ONBOARDING: { label: 'Onboarding drafts', tab: 'EMPLOYEES' },
  ATTENDANCE: { label: 'Attendance', tab: 'ATTENDANCE' },
  SCHEDULES: { label: 'Schedules & holidays', tab: 'ATTENDANCE' },
  LEAVE_REQUESTS: { label: 'Leave requests', tab: 'LEAVE' },
  LEAVE_BALANCES: { label: 'Leave balances', tab: 'LEAVE' },
  EVALUATIONS: { label: 'Evaluations', tab: 'EVALUATIONS' },
  EVALUATION_FORMS: { label: 'Evaluation forms', tab: 'EVALUATIONS' },
  TRAINING: { label: 'Training & seminars', tab: 'COMPLIANCE' },
  COMPLIANCE: { label: 'Compliance', tab: 'COMPLIANCE' },
  MEDICAL: { label: 'Medical & psychological', tab: 'COMPLIANCE' },
  JOB_OPENINGS: { label: 'Job openings & positions', tab: 'RECRUITMENT' },
  APPLICANTS: { label: 'Applicants', tab: 'RECRUITMENT' },
  ANNOUNCEMENTS: { label: 'Announcements', tab: 'COMMUNICATION' },
  CALENDAR_NOTES: { label: 'Calendar notes', tab: 'COMMUNICATION' },
  AWARDS: { label: 'Awards & recognition', tab: 'AWARDS' },
  ACHIEVEMENTS: { label: 'Yearly achievements', tab: 'AWARDS' },
  MAINTENANCE: { label: 'Data maintenance', tab: 'SYSTEM' },
  OTHER: { label: 'Other', tab: 'SYSTEM' },
  SIGN_IN: { label: 'Sign-in & sessions', tab: 'SECURITY' },
  ACCOUNTS: { label: 'User accounts & passwords', tab: 'SECURITY' },
  RECORD_ACCESS: { label: 'Record access', tab: 'SECURITY' },
};

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'APPROVE'
  | 'REJECT'
  | 'FINALIZE'
  | 'PUBLISH'
  | 'ASSIGN'
  | 'UPLOAD'
  | 'IMPORT'
  | 'STATUS_CHANGE'
  | 'SUBMIT'
  | 'REVIEW'
  | 'SEND'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'PASSWORD'
  | 'ACCESS'
  | 'VIEW';

/** Filter label, and the past-tense word a row shows when the action has no own label. */
export const AUDIT_ACTION_TYPES: Record<AuditActionType, { label: string; past: string }> = {
  CREATE: { label: 'Create', past: 'Created' },
  UPDATE: { label: 'Update', past: 'Updated' },
  DELETE: { label: 'Delete / remove', past: 'Removed' },
  ARCHIVE: { label: 'Archive / deactivate', past: 'Archived' },
  RESTORE: { label: 'Restore', past: 'Restored' },
  APPROVE: { label: 'Approve / endorse', past: 'Approved' },
  REJECT: { label: 'Reject / decline', past: 'Declined' },
  FINALIZE: { label: 'Finalize / close', past: 'Finalized' },
  PUBLISH: { label: 'Publish', past: 'Published' },
  ASSIGN: { label: 'Assign / reassign', past: 'Assigned' },
  UPLOAD: { label: 'Upload', past: 'Uploaded' },
  IMPORT: { label: 'Import', past: 'Imported' },
  STATUS_CHANGE: { label: 'Status change', past: 'Status changed' },
  SUBMIT: { label: 'Submit', past: 'Submitted' },
  REVIEW: { label: 'Review', past: 'Reviewed' },
  SEND: { label: 'Send / notify', past: 'Sent' },
  SIGN_IN: { label: 'Sign-in', past: 'Signed in' },
  SIGN_OUT: { label: 'Sign-out', past: 'Signed out' },
  PASSWORD: { label: 'Password', past: 'Password' },
  ACCESS: { label: 'Account access change', past: 'Access changed' },
  VIEW: { label: 'View / open', past: 'Viewed' },
};

/**
 * `text` is the sentence after the actor's name:
 *   {s} the person the event is about (employee or applicant). When unknown, or
 *       when it is the actor themself, " of {s}" (any short preposition) is dropped.
 *   {r} the record, e.g. “Sick leave 2026” or an announcement title; dropped when unknown.
 * `impersonal` sentences are not prefixed with the actor (system outcomes).
 */
interface Entry {
  module: AuditModule;
  type: AuditActionType;
  text: string;
  label?: string;
  impersonal?: boolean;
}

const E = (module: AuditModule, type: AuditActionType, text: string, label?: string): Entry => ({ module, type, text, label });

const ENTRIES: Record<string, Entry> = {
  // ── Employees ──────────────────────────────────────────────────────────
  // Written next to EMPLOYEE_CREATED for the same hire: it adds the account and welcome-email outcome.
  CREATE_EMPLOYEE: E('EMPLOYEE_RECORDS', 'CREATE', 'finished setting up the new employee {s} (account and welcome email)', 'Set-up completed'),
  EMPLOYEE_CREATED: E('EMPLOYEE_RECORDS', 'CREATE', 'created the employee record of {s}'),
  UPDATE_EMPLOYEE: E('EMPLOYEE_RECORDS', 'UPDATE', 'updated the employee record of {s}'),
  EMPLOYEE_ARCHIVED: E('EMPLOYEE_RECORDS', 'ARCHIVE', 'archived the employee record of {s}'),
  EMPLOYEE_RESTORED: E('EMPLOYEE_RECORDS', 'RESTORE', 'restored the employee record of {s}'),
  EMPLOYEE_LEAVE_ELIGIBILITY_UPDATED: E('EMPLOYEE_RECORDS', 'UPDATE', 'updated the leave eligibility of {s}'),
  APPLICATION_LINKED_TO_EMPLOYEE: E('EMPLOYEE_RECORDS', 'UPDATE', 'linked a job application to the employee record of {s}', 'Linked'),
  DOCUMENT_UPLOADED: E('EMPLOYEE_DOCUMENTS', 'UPLOAD', 'uploaded the document {r} for {s}'),
  DOCUMENT_REPLACED: E('EMPLOYEE_DOCUMENTS', 'UPLOAD', 'replaced the document {r} of {s}', 'Replaced'),
  DOCUMENT_DELETED: E('EMPLOYEE_DOCUMENTS', 'DELETE', 'removed the document {r} of {s}'),
  DOCUMENT_METADATA_UPDATED: E('EMPLOYEE_DOCUMENTS', 'UPDATE', 'updated the details of the document {r} of {s}'),
  DOCUMENT_VISIBILITY_CHANGED: E('EMPLOYEE_DOCUMENTS', 'UPDATE', 'changed who can see the document {r} of {s}', 'Visibility changed'),
  EMPLOYEE_ORGANIZATION_UPDATED: E('ORGANIZATION', 'UPDATE', 'changed the unit, department or job role of {s}'),
  SUPERVISOR_OVERRIDE_APPLIED: E('ORGANIZATION', 'ASSIGN', 'changed the immediate supervisor of {s}', 'Supervisor changed'),
  SUPERVISOR_OVERRIDE_REMOVED: E('ORGANIZATION', 'ASSIGN', 'removed the supervisor override of {s}', 'Override removed'),
  ADDITIONAL_OVERSIGHT_ADDED: E('ORGANIZATION', 'ASSIGN', 'added additional oversight {r}', 'Oversight added'),
  ADDITIONAL_OVERSIGHT_REMOVED: E('ORGANIZATION', 'ASSIGN', 'removed additional oversight {r}', 'Oversight removed'),
  JOB_ROLE_CREATED: E('ORGANIZATION', 'CREATE', 'created the job role {r}'),
  CREATE_DRAFT: E('ONBOARDING', 'CREATE', 'started an onboarding draft'),
  UPDATE_DRAFT: E('ONBOARDING', 'UPDATE', 'updated an onboarding draft'),
  COMPLETE_DRAFT: E('ONBOARDING', 'FINALIZE', 'completed an onboarding draft', 'Completed'),
  DELETE_DRAFT: E('ONBOARDING', 'DELETE', 'deleted an onboarding draft', 'Deleted'),

  // ── Attendance & schedules ─────────────────────────────────────────────
  UPDATE_ATTENDANCE: E('ATTENDANCE', 'UPDATE', 'corrected the attendance record {r} of {s}', 'Corrected'),
  ATTENDANCE_IMPORT_UPLOADED: E('ATTENDANCE', 'UPLOAD', 'uploaded the biometric attendance file {r}'),
  ATTENDANCE_IMPORT_APPLIED: E('ATTENDANCE', 'IMPORT', 'imported attendance from {r}'),
  ATTENDANCE_IMPORT_CANCELLED: E('ATTENDANCE', 'STATUS_CHANGE', 'cancelled the attendance import {r}', 'Cancelled'),
  ATTENDANCE_BIOMETRIC_CODE_MAPPED: E('ATTENDANCE', 'UPDATE', 'matched a biometric code to {s}', 'Code matched'),
  TEMPLATE_CREATED: E('SCHEDULES', 'CREATE', 'created the schedule template {r}'),
  TEMPLATE_REVISED: E('SCHEDULES', 'UPDATE', 'revised the schedule template {r}', 'Revised'),
  TEMPLATE_ASSIGNED: E('SCHEDULES', 'ASSIGN', 'assigned the schedule template {r} to {s}'),
  WEEKLY_SCHEDULE_REVISED: E('SCHEDULES', 'UPDATE', 'revised the weekly schedule of {s}', 'Revised'),
  MANUAL_HOLIDAY_CREATED: E('SCHEDULES', 'CREATE', 'added the calendar entry {r}'),
  CALENDAR_ENTRY_UPDATED: E('SCHEDULES', 'UPDATE', 'updated the calendar entry {r}'),
  CALENDAR_ENTRY_DEACTIVATED: E('SCHEDULES', 'ARCHIVE', 'deactivated the calendar entry {r}', 'Deactivated'),
  CALENDAR_ENTRY_WORKING_UNITS_UPDATED: E('SCHEDULES', 'UPDATE', 'changed which units work on {r}'),

  // ── Leave ──────────────────────────────────────────────────────────────
  LEAVE_FILED: E('LEAVE_REQUESTS', 'SUBMIT', 'filed a leave request {r} for {s}', 'Filed'),
  LEAVE_REQUEST_CREATED_ON_BEHALF: E('LEAVE_REQUESTS', 'CREATE', 'filed a leave request {r} on behalf of {s}', 'Filed for employee'),
  LEAVE_ENDORSED: E('LEAVE_REQUESTS', 'APPROVE', 'endorsed the leave request {r} of {s} to HR', 'Endorsed'),
  LEAVE_REVISION_PROPOSED: E('LEAVE_REQUESTS', 'APPROVE', 'endorsed, with a proposed change, the leave request {r} of {s}', 'Endorsed with change'),
  LEAVE_APPROVED: E('LEAVE_REQUESTS', 'APPROVE', 'approved the leave request {r} of {s}'),
  LEAVE_APPROVED_WITH_REVISION: E('LEAVE_REQUESTS', 'APPROVE', 'approved, with changes, the leave request {r} of {s}', 'Approved with changes'),
  LEAVE_REJECTED: E('LEAVE_REQUESTS', 'REJECT', 'declined the leave request {r} of {s}'),
  LEAVE_CANCELLED: E('LEAVE_REQUESTS', 'STATUS_CHANGE', 'cancelled the leave request {r} of {s}', 'Cancelled'),
  LEAVE_BALANCE_CREATED: E('LEAVE_BALANCES', 'CREATE', 'set up the leave balance {r} of {s}'),
  LEAVE_BALANCE_UPDATED: E('LEAVE_BALANCES', 'UPDATE', 'adjusted the leave balance {r} of {s}', 'Adjusted'),
  LEAVE_ENTITLEMENT_APPLIED: E('LEAVE_BALANCES', 'UPDATE', 'applied the service-based entitlement {r} to {s}', 'Entitlement applied'),
  LEAVE_ENTITLEMENT_UPDATED: E('LEAVE_BALANCES', 'UPDATE', 'updated the service-based entitlement {r} of {s}'),
  LEAVE_BALANCE_SWITCHED_TO_AUTOMATIC: E('LEAVE_BALANCES', 'UPDATE', 'switched the leave balance {r} of {s} back to automatic'),
  LEAVE_BALANCE_PENDING_ANOMALY: E('LEAVE_BALANCES', 'UPDATE', 'corrected a pending-days mismatch on the leave balance {r} of {s}', 'Corrected'),

  // ── Evaluations ────────────────────────────────────────────────────────
  EVALUATION_CYCLE_CREATED: E('EVALUATIONS', 'CREATE', 'created the evaluation cycle {r}'),
  EVALUATION_CYCLE_SCORING_UPDATED: E('EVALUATIONS', 'UPDATE', 'changed the scoring of the evaluation cycle {r}'),
  EVALUATION_CYCLE_CLOSED: E('EVALUATIONS', 'FINALIZE', 'closed the evaluation cycle {r}', 'Closed'),
  EVALUATION_HEAD_EVALUATOR_ASSIGNED: E('EVALUATIONS', 'ASSIGN', 'assigned the head evaluator {r} for {s}'),
  EVALUATION_HEAD_EVALUATOR_CHANGED: E('EVALUATIONS', 'ASSIGN', 'changed the head evaluator {r} for {s}', 'Reassigned'),
  EVALUATION_PEERS_ASSIGNED: E('EVALUATIONS', 'ASSIGN', 'assigned peer evaluators {r} for {s}'),
  EVALUATION_PEER_REMOVED: E('EVALUATIONS', 'ASSIGN', 'removed a peer evaluator {r} for {s}', 'Peer removed'),
  EVALUATION_DRAFT_SAVED: E('EVALUATIONS', 'UPDATE', 'saved a draft evaluation {r} of {s}', 'Draft saved'),
  EVALUATION_SUBMITTED: E('EVALUATIONS', 'SUBMIT', 'submitted an evaluation {r} of {s}'),
  EVALUATION_FINALIZED: E('EVALUATIONS', 'FINALIZE', 'finalized the evaluation {r} of {s}'),
  EVALUATION_DISCUSSION_COMPLETED: E('EVALUATIONS', 'UPDATE', 'recorded the evaluation discussion {r} with {s}', 'Discussion recorded'),
  EVALUATION_TEMPLATE_CREATED: E('EVALUATION_FORMS', 'CREATE', 'created the evaluation form {r}'),
  EVALUATION_TEMPLATE_UPDATED: E('EVALUATION_FORMS', 'UPDATE', 'updated the evaluation form {r}'),
  EVALUATION_TEMPLATE_DUPLICATED: E('EVALUATION_FORMS', 'CREATE', 'duplicated the evaluation form {r}', 'Duplicated'),
  EVALUATION_TEMPLATE_DEACTIVATED: E('EVALUATION_FORMS', 'ARCHIVE', 'deactivated the evaluation form {r}', 'Deactivated'),
  EVALUATION_TEMPLATE_JOB_ROLES_UPDATED: E('EVALUATION_FORMS', 'ASSIGN', 'changed which job roles use the evaluation form {r}'),
  EVALUATION_OFFICIAL_TEMPLATE_INSTALLED: E('EVALUATION_FORMS', 'CREATE', 'installed the official evaluation form {r}', 'Installed'),

  // ── Training, compliance, medical & psychological ──────────────────────
  TRAINING_CERTIFICATE_UPLOADED: E('TRAINING', 'UPLOAD', 'uploaded a training certificate {r} for {s}'),
  TRAINING_DOCUMENT_UPLOADED: E('TRAINING', 'UPLOAD', 'uploaded a training document {r}'),
  COMPLIANCE_REQUIREMENT_CREATED: E('COMPLIANCE', 'CREATE', 'created the compliance requirement {r}'),
  COMPLIANCE_REQUIREMENT_UPDATED: E('COMPLIANCE', 'UPDATE', 'updated the compliance requirement {r}'),
  COMPLIANCE_REQUIREMENT_ARCHIVED: E('COMPLIANCE', 'ARCHIVE', 'archived the compliance requirement {r}'),
  COMPLIANCE_SCOPE_ADDED: E('COMPLIANCE', 'ASSIGN', 'added a group that must meet the compliance requirement {r}', 'Scope added'),
  COMPLIANCE_SCOPE_REMOVED: E('COMPLIANCE', 'ASSIGN', 'removed a group from the compliance requirement {r}', 'Scope removed'),
  COMPLIANCE_RECORD_CREATED: E('COMPLIANCE', 'CREATE', 'added the compliance record {r} for {s}'),
  COMPLIANCE_RECORD_REVIEWED: E('COMPLIANCE', 'REVIEW', 'reviewed the compliance record {r} of {s}'),
  COMPLIANCE_RECORD_DELETED: E('COMPLIANCE', 'DELETE', 'removed the compliance record {r} of {s}'),
  MEDICAL_RECORD_CREATED: E('MEDICAL', 'CREATE', 'added a medical record for {s}'),
  MEDICAL_RECORD_UPDATED: E('MEDICAL', 'UPDATE', 'updated a medical record of {s}'),
  MEDICAL_RECORD_REVIEWED: E('MEDICAL', 'REVIEW', 'reviewed a medical record of {s}'),
  MEDICAL_RECORD_DELETED: E('MEDICAL', 'DELETE', 'removed a medical record of {s}'),
  MEDICAL_DOCUMENT_UPLOADED: E('MEDICAL', 'UPLOAD', 'uploaded a medical document for {s}'),
  MEDICAL_DOCUMENT_DELETED: E('MEDICAL', 'DELETE', 'removed a medical document of {s}'),
  PSYCH_RECORD_CREATED: E('MEDICAL', 'CREATE', 'added a psychological record for {s}'),
  PSYCH_RECORD_UPDATED: E('MEDICAL', 'UPDATE', 'updated a psychological record of {s}'),
  PSYCH_RECORD_REVIEWED: E('MEDICAL', 'REVIEW', 'reviewed a psychological record of {s}'),
  PSYCH_RECORD_DELETED: E('MEDICAL', 'DELETE', 'removed a psychological record of {s}'),
  PSYCH_DOCUMENT_UPLOADED: E('MEDICAL', 'UPLOAD', 'uploaded a psychological document for {s}'),
  PSYCH_DOCUMENT_DELETED: E('MEDICAL', 'DELETE', 'removed a psychological document of {s}'),

  // ── Recruitment ────────────────────────────────────────────────────────
  JOB_OPENING_CREATED: E('JOB_OPENINGS', 'CREATE', 'created the job opening {r}'),
  JOB_OPENING_UPDATED: E('JOB_OPENINGS', 'UPDATE', 'updated the job opening {r}'),
  APPLICANT_NOTE_ADDED: E('APPLICANTS', 'CREATE', 'added a note to the application {r} of {s}', 'Note added'),
  INTERVIEW_SCHEDULED: E('APPLICANTS', 'CREATE', 'scheduled an interview {r} with {s}', 'Interview scheduled'),
  INTERVIEW_RESCHEDULED: E('APPLICANTS', 'UPDATE', 'rescheduled the interview {r} with {s}', 'Interview rescheduled'),
  APPLICANT_CONVERTED_TO_ONBOARDING: E('APPLICANTS', 'CREATE', 'turned the application {r} of {s} into an onboarding draft', 'Converted to onboarding'),
  AUTOMATIC_EMAIL_FAILED: {
    module: 'APPLICANTS',
    type: 'SEND',
    text: 'An automatic email {r} to {s} could not be sent',
    label: 'Email failed',
    impersonal: true,
  },

  // ── Announcements & communication ──────────────────────────────────────
  ANNOUNCEMENT_CREATED: E('ANNOUNCEMENTS', 'CREATE', 'created the announcement {r}'),
  ANNOUNCEMENT_UPDATED: E('ANNOUNCEMENTS', 'UPDATE', 'updated the announcement {r}'),
  ANNOUNCEMENT_SCHEDULED: E('ANNOUNCEMENTS', 'PUBLISH', 'scheduled the announcement {r}', 'Scheduled'),
  ANNOUNCEMENT_ACTIVATED: E('ANNOUNCEMENTS', 'PUBLISH', 'published the announcement {r}'),
  ANNOUNCEMENT_ARCHIVED: E('ANNOUNCEMENTS', 'ARCHIVE', 'archived the announcement {r}'),
  ANNOUNCEMENT_DELETED: E('ANNOUNCEMENTS', 'DELETE', 'deleted the announcement {r}', 'Deleted'),
  ANNOUNCEMENT_DRAFT_DELETED: E('ANNOUNCEMENTS', 'DELETE', 'deleted the draft announcement {r}', 'Draft deleted'),
  ANNOUNCEMENT_ATTACHMENT_UPLOADED: E('ANNOUNCEMENTS', 'UPLOAD', 'attached a file to the announcement {r}'),
  ANNOUNCEMENT_ATTACHMENT_REMOVED: E('ANNOUNCEMENTS', 'DELETE', 'removed a file from the announcement {r}'),
  CALENDAR_NOTE_POSTED: E('CALENDAR_NOTES', 'PUBLISH', 'posted the calendar note {r}', 'Posted'),
  CALENDAR_NOTE_UPDATED: E('CALENDAR_NOTES', 'UPDATE', 'updated the calendar note {r}'),
  CALENDAR_NOTE_DELETED: E('CALENDAR_NOTES', 'DELETE', 'removed the calendar note {r}'),
  // A personal note is private to its author: its title is never shown here.
  PERSONAL_NOTE_CREATED: E('CALENDAR_NOTES', 'CREATE', 'added a personal calendar note'),
  PERSONAL_NOTE_UPDATED: E('CALENDAR_NOTES', 'UPDATE', 'edited a personal calendar note'),
  PERSONAL_NOTE_COMPLETED: E('CALENDAR_NOTES', 'STATUS_CHANGE', 'marked a personal calendar note done', 'Marked done'),
  PERSONAL_NOTE_REOPENED: E('CALENDAR_NOTES', 'STATUS_CHANGE', 'reopened a personal calendar note', 'Reopened'),
  PERSONAL_NOTE_DELETED: E('CALENDAR_NOTES', 'DELETE', 'deleted a personal calendar note'),

  // ── Awards & achievements ──────────────────────────────────────────────
  AWARD_CREATED: E('AWARDS', 'CREATE', 'created the award {r}'),
  AWARD_UPDATED: E('AWARDS', 'UPDATE', 'updated the award {r}'),
  AWARD_DELETED: E('AWARDS', 'DELETE', 'deleted the award {r}', 'Deleted'),
  AWARD_STATUS_CHANGED: E('AWARDS', 'STATUS_CHANGE', 'moved the award {r} to its next stage'),
  AWARD_FINALIZED: E('AWARDS', 'FINALIZE', 'finalized the award {r}'),
  AWARD_RESULT_DECIDED: E('AWARDS', 'UPDATE', 'recorded a deliberation decision on {s} for {r}', 'Decision recorded'),
  AWARD_SHORTLIST_CONFIRMED: E('AWARDS', 'APPROVE', 'confirmed the shortlist of {r}', 'Shortlist confirmed'),
  AWARD_NOMINATION_SUBMITTED: E('AWARDS', 'SUBMIT', 'nominated {s} for {r}', 'Nominated'),
  // A ballot entry records only that a ballot was cast — never the choices.
  AWARD_BALLOT_SUBMITTED: E('AWARDS', 'SUBMIT', 'cast a ballot for {r}', 'Ballot cast'),
  AWARD_GROUP_CREATED: E('AWARDS', 'CREATE', 'created the voting group {r}'),
  AWARD_GROUP_UPDATED: E('AWARDS', 'UPDATE', 'updated the voting group {r}'),
  AWARD_GROUP_DELETED: E('AWARDS', 'DELETE', 'deleted the voting group {r}', 'Deleted'),
  HALL_OF_FAME_RECORDED: E('AWARDS', 'CREATE', 'added {s} to the Hall of Fame {r}', 'Hall of Fame added'),
  HALL_OF_FAME_REMOVED: E('AWARDS', 'DELETE', 'removed {s} from the Hall of Fame {r}', 'Hall of Fame removed'),
  YEARLY_ACHIEVEMENTS_CREATED: E('ACHIEVEMENTS', 'CREATE', 'created the page {r}'),
  YEARLY_ACHIEVEMENTS_UPDATED: E('ACHIEVEMENTS', 'UPDATE', 'updated the page {r}'),
  YEARLY_ACHIEVEMENTS_PUBLISHED: E('ACHIEVEMENTS', 'PUBLISH', 'published the page {r}'),
  YEARLY_ACHIEVEMENTS_UNPUBLISHED: E('ACHIEVEMENTS', 'STATUS_CHANGE', 'unpublished the page {r}', 'Unpublished'),
  YEARLY_ACHIEVEMENTS_DELETED: E('ACHIEVEMENTS', 'DELETE', 'deleted the page {r}', 'Deleted'),
  YEARLY_ACHIEVEMENT_ADDED: E('ACHIEVEMENTS', 'CREATE', 'added the achievement {r}', 'Added'),
  YEARLY_ACHIEVEMENT_UPDATED: E('ACHIEVEMENTS', 'UPDATE', 'updated the achievement {r}'),
  YEARLY_ACHIEVEMENT_REMOVED: E('ACHIEVEMENTS', 'DELETE', 'removed the achievement {r}'),

  // ── System: one-off data-maintenance scripts ───────────────────────────
  DEVELOPMENT_ACCOUNT_STANDARDIZED: E('MAINTENANCE', 'UPDATE', 'standardised the development account {r}', 'Standardised'),
  SUPERVISOR_ASSIGNMENT_MIGRATED: E('MAINTENANCE', 'UPDATE', 'migrated the supervisor assignment of {s}', 'Migrated'),
  FIX_SUPERVISOR_ASSIGNMENT: E('MAINTENANCE', 'ASSIGN', 'corrected the supervisor of {s}', 'Corrected'),
  AUTO_SUPERVISOR_RESOLUTION: E('MAINTENANCE', 'ASSIGN', 'resolved the supervisor of {s} automatically', 'Resolved'),
  FIX_DISPLAY_NAME: E('MAINTENANCE', 'UPDATE', 'corrected the display name of {s}', 'Corrected'),
  HSJ_EMPLOYEE_ARCHIVED: E('MAINTENANCE', 'ARCHIVE', 'archived {s} in a data cleanup'),

  // ── Security & authentication ──────────────────────────────────────────
  LOGIN_SUCCESS: E('SIGN_IN', 'SIGN_IN', 'signed in'),
  LOGIN_FAILED: {
    module: 'SIGN_IN',
    type: 'SIGN_IN',
    text: 'A sign-in to the account of {a} failed',
    label: 'Sign-in failed',
    impersonal: true,
  },
  GOOGLE_LOGIN_SUCCESS: E('SIGN_IN', 'SIGN_IN', 'signed in with Google', 'Signed in with Google'),
  GOOGLE_LOGIN_FAILED: {
    module: 'SIGN_IN',
    type: 'SIGN_IN',
    text: 'A Google sign-in to the account of {a} was refused',
    label: 'Google sign-in refused',
    impersonal: true,
  },
  GOOGLE_LOGIN_UNREGISTERED: {
    module: 'SIGN_IN',
    type: 'SIGN_IN',
    text: 'A Google sign-in with the unregistered email {r} was refused',
    label: 'Unregistered Google sign-in',
    impersonal: true,
  },
  GOOGLE_LOGIN_BLOCKED: {
    module: 'SIGN_IN',
    type: 'SIGN_IN',
    text: 'Google sign-in was blocked for the network {r} after repeated unregistered sign-ins',
    label: 'Google sign-in blocked',
    impersonal: true,
  },
  LOGOUT: E('SIGN_IN', 'SIGN_OUT', 'signed out'),
  TOKEN_REFRESHED: E('SIGN_IN', 'SIGN_IN', 'refreshed their session', 'Session refreshed'),
  PASSWORD_CHANGED: E('ACCOUNTS', 'PASSWORD', 'changed their password', 'Password changed'),
  PASSWORD_CHANGE_FAILED: E('ACCOUNTS', 'PASSWORD', 'tried to change their password, but it failed', 'Password change failed'),
  PASSWORD_RESET_REQUESTED: E('ACCOUNTS', 'PASSWORD', 'requested a password reset link', 'Reset requested'),
  PASSWORD_RESET: E('ACCOUNTS', 'PASSWORD', 'reset their password with an emailed link', 'Password reset'),
  RESET_PASSWORD: E('ACCOUNTS', 'PASSWORD', 'issued a temporary password for {s}', 'Temporary password issued'),
  FORCE_PASSWORD_CHANGE: E('ACCOUNTS', 'PASSWORD', 'required a password change at the next sign-in of {s}', 'Password change required'),
  ACCOUNT_LOCKED: E('ACCOUNTS', 'ACCESS', 'locked the account of {s}', 'Account locked'),
  ACCOUNT_UNLOCKED: E('ACCOUNTS', 'ACCESS', 'unlocked the account of {s}', 'Account unlocked'),
  ACTIVATE_USER: E('ACCOUNTS', 'ACCESS', 'activated the account of {s}', 'Account activated'),
  DEACTIVATE_USER: E('ACCOUNTS', 'ACCESS', 'deactivated the account of {s}', 'Account deactivated'),
  HSJ_USER_DEACTIVATED: E('ACCOUNTS', 'ACCESS', 'deactivated the account of {s} in a data cleanup', 'Account deactivated'),
  USER_ACCOUNT_CREATED: E('ACCOUNTS', 'CREATE', 'created a user account for {s}', 'Account created'),
  ACCOUNT_LOGIN_EMAIL_CHANGED: E('ACCOUNTS', 'UPDATE', 'changed the sign-in email of {s}', 'Sign-in email changed'),
  APPLICANT_DOCUMENT_PREVIEWED: E('RECORD_ACCESS', 'VIEW', 'previewed the applicant document {r} of {s}', 'Document previewed'),
  APPLICANT_DOCUMENT_ACCESSED: E('RECORD_ACCESS', 'VIEW', 'opened the applicant document {r} of {s}', 'Document opened'),
  AI_ASSISTANT_DATA_ACCESS: E('RECORD_ACCESS', 'VIEW', 'looked up the records of {s} through the AI assistant', 'AI data access'),
};

/** Actions written with a variable suffix, e.g. `JOB_APPLICATION_STATUS_HIRED`. */
const FAMILIES: Array<{ prefix: string; build: (suffix: string) => Entry }> = [
  {
    prefix: 'JOB_APPLICATION_STATUS_',
    build: (s) =>
      s === 'REJECTED'
        ? E('APPLICANTS', 'REJECT', 'declined the application {r} of {s}', 'Application declined')
        : E('APPLICANTS', 'STATUS_CHANGE', `moved the application {r} of {s} to “${humanise(s)}”`, humanise(s)),
  },
  {
    prefix: 'JOB_OPENING_',
    build: (s) =>
      s === 'OPEN'
        ? E('JOB_OPENINGS', 'PUBLISH', 'published the job opening {r}')
        : s === 'ARCHIVED'
          ? E('JOB_OPENINGS', 'ARCHIVE', 'archived the job opening {r}')
          : E('JOB_OPENINGS', 'STATUS_CHANGE', `changed the job opening {r} to “${humanise(s)}”`, humanise(s)),
  },
  {
    prefix: 'INTERVIEW_STATUS_',
    build: (s) => E('APPLICANTS', 'STATUS_CHANGE', `marked the interview {r} with {s} as “${humanise(s)}”`, `Interview ${humanise(s).toLowerCase()}`),
  },
  {
    prefix: 'APPLICANT_COMMUNICATION_RETRY_',
    build: (s) =>
      E('APPLICANTS', 'SEND', s === 'FAILED' ? 'retried a message {r} to {s}, but it failed' : 'resent a message {r} to {s}', s === 'FAILED' ? 'Resend failed' : 'Message resent'),
  },
  {
    prefix: 'APPLICANT_COMMUNICATION_',
    build: (s) =>
      E(
        'APPLICANTS',
        'SEND',
        s === 'FAILED'
          ? 'tried to send a message {r} to {s}, but it failed'
          : s === 'SIMULATED'
            ? 'recorded a message {r} to {s} (simulated — email sending is off)'
            : 'sent a message {r} to {s}',
        s === 'FAILED' ? 'Message failed' : s === 'SIMULATED' ? 'Message simulated' : 'Message sent'
      ),
  },
  {
    prefix: 'HOLIDAY_SUGGESTION_',
    build: (s) =>
      s === 'APPROVED'
        ? E('SCHEDULES', 'APPROVE', 'approved the suggested holiday {r}')
        : s === 'REJECTED' || s === 'IGNORED' || s === 'DISMISSED'
          ? E('SCHEDULES', 'REJECT', 'declined the suggested holiday {r}')
          : E('SCHEDULES', 'STATUS_CHANGE', `marked the suggested holiday {r} as “${humanise(s)}”`),
  },
];

/** Prefix → module for actions this file has never seen. */
const PREFIX_MODULES: Array<[string, AuditModule]> = [
  ['LEAVE_BALANCE', 'LEAVE_BALANCES'],
  ['LEAVE_ENTITLEMENT', 'LEAVE_BALANCES'],
  ['LEAVE_', 'LEAVE_REQUESTS'],
  ['EVALUATION_TEMPLATE', 'EVALUATION_FORMS'],
  ['EVALUATION_', 'EVALUATIONS'],
  ['ATTENDANCE_', 'ATTENDANCE'],
  ['SCHEDULE', 'SCHEDULES'],
  ['TEMPLATE_', 'SCHEDULES'],
  ['HOLIDAY', 'SCHEDULES'],
  ['CALENDAR_ENTRY', 'SCHEDULES'],
  ['CALENDAR_NOTE', 'CALENDAR_NOTES'],
  ['PERSONAL_NOTE', 'CALENDAR_NOTES'],
  ['TRAINING_', 'TRAINING'],
  ['COMPLIANCE_', 'COMPLIANCE'],
  ['MEDICAL_', 'MEDICAL'],
  ['PSYCH', 'MEDICAL'],
  ['JOB_OPENING', 'JOB_OPENINGS'],
  ['JOB_ROLE', 'ORGANIZATION'],
  ['APPLICANT', 'APPLICANTS'],
  ['JOB_APPLICATION', 'APPLICANTS'],
  ['INTERVIEW', 'APPLICANTS'],
  ['ANNOUNCEMENT', 'ANNOUNCEMENTS'],
  ['AWARD', 'AWARDS'],
  ['HALL_OF_FAME', 'AWARDS'],
  ['YEARLY_ACHIEVEMENT', 'ACHIEVEMENTS'],
  ['DOCUMENT_', 'EMPLOYEE_DOCUMENTS'],
  ['SUPERVISOR', 'ORGANIZATION'],
  ['ADDITIONAL_OVERSIGHT', 'ORGANIZATION'],
  ['EMPLOYEE', 'EMPLOYEE_RECORDS'],
  ['LOGIN', 'SIGN_IN'],
  ['GOOGLE_LOGIN', 'SIGN_IN'],
  ['LOGOUT', 'SIGN_IN'],
  ['TOKEN', 'SIGN_IN'],
  ['SESSION', 'SIGN_IN'],
  ['OTP', 'SIGN_IN'],
  ['PASSWORD', 'ACCOUNTS'],
  ['ACCOUNT', 'ACCOUNTS'],
  ['USER_', 'ACCOUNTS'],
];

/** Record type → module, the last resort for an unknown action. */
const ENTITY_MODULES: Record<string, AuditModule> = {
  EMPLOYEE: 'EMPLOYEE_RECORDS',
  EMPLOYEE_DOCUMENT: 'EMPLOYEE_DOCUMENTS',
  LEAVEREQUEST: 'LEAVE_REQUESTS',
  LEAVEBALANCE: 'LEAVE_BALANCES',
  ATTENDANCERECORD: 'ATTENDANCE',
  ATTENDANCE_IMPORT_BATCH: 'ATTENDANCE',
  EVALUATIONCYCLE: 'EVALUATIONS',
  EVALUATIONASSIGNMENT: 'EVALUATIONS',
  EVALUATIONTEMPLATE: 'EVALUATION_FORMS',
  COMPLIANCE_REQUIREMENT: 'COMPLIANCE',
  EMPLOYEE_COMPLIANCE_RECORD: 'COMPLIANCE',
  MEDICAL_RECORD: 'MEDICAL',
  PSYCHOLOGICAL_RECORD: 'MEDICAL',
  JOBOPENING: 'JOB_OPENINGS',
  JOBAPPLICATION: 'APPLICANTS',
  APPLICANTDOCUMENT: 'RECORD_ACCESS',
  APPLICANTINTERVIEW: 'APPLICANTS',
  APPLICANTCOMMUNICATION: 'APPLICANTS',
  ANNOUNCEMENT: 'ANNOUNCEMENTS',
  CALENDARNOTE: 'CALENDAR_NOTES',
  AWARD: 'AWARDS',
  YEARLYACHIEVEMENTPAGE: 'ACHIEVEMENTS',
  ADDITIONALOVERSIGHT: 'ORGANIZATION',
  USER: 'ACCOUNTS',
  DRAFT: 'ONBOARDING',
};

function guessType(action: string): AuditActionType {
  const rules: Array<[RegExp, AuditActionType]> = [
    [/LOGIN|SIGN_?IN|TOKEN|SESSION|OTP/, 'SIGN_IN'],
    [/LOGOUT|SIGN_?OUT/, 'SIGN_OUT'],
    [/PASSWORD/, 'PASSWORD'],
    [/LOCK|ACTIVAT/, 'ACCESS'],
    [/RESTORE/, 'RESTORE'],
    [/ARCHIVE|DEACTIVAT/, 'ARCHIVE'],
    [/DELETE|REMOVE/, 'DELETE'],
    [/APPROVE|ENDORSE|CONFIRM/, 'APPROVE'],
    [/REJECT|DECLINE/, 'REJECT'],
    [/FINALI[SZ]E|CLOSE|COMPLETE/, 'FINALIZE'],
    [/PUBLISH|POSTED/, 'PUBLISH'],
    [/ASSIGN|OVERRIDE/, 'ASSIGN'],
    [/UPLOAD|REPLACED/, 'UPLOAD'],
    [/IMPORT/, 'IMPORT'],
    [/SUBMIT|FILED/, 'SUBMIT'],
    [/REVIEW/, 'REVIEW'],
    [/SENT|SEND|EMAIL|NOTIF/, 'SEND'],
    [/VIEW|PREVIEW|ACCESS|DOWNLOAD/, 'VIEW'],
    [/CREATE|ADDED|^CREATED$/, 'CREATE'],
    [/STATUS/, 'STATUS_CHANGE'],
  ];
  for (const [re, type] of rules) if (re.test(action)) return type;
  return 'UPDATE';
}

export interface ActionInfo {
  action: string;
  module: AuditModule;
  moduleLabel: string;
  tab: AuditTab;
  tabLabel: string;
  type: AuditActionType;
  typeLabel: string;
  /** Short word(s) for the row's Action column, e.g. "Approved". */
  label: string;
  text: string;
  impersonal: boolean;
  outcome: 'SUCCESS' | 'FAILURE';
  /** Values of this module's records are confidential (medical / psychological). */
  confidential: boolean;
  /** True when this file had no mapping and fell back to guesses. */
  unmapped: boolean;
}

const cache = new Map<string, ActionInfo>();

export function describeAction(action: string, entityType?: string | null): ActionInfo {
  const key = `${action}|${entityType ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let entry: Entry | undefined = ENTRIES[action];
  if (!entry) {
    const family = FAMILIES.find((f) => action.startsWith(f.prefix) && action.length > f.prefix.length);
    if (family) entry = family.build(action.slice(family.prefix.length));
  }
  const unmapped = !entry;
  if (!entry) {
    const byPrefix = PREFIX_MODULES.find(([p]) => action.startsWith(p))?.[1];
    const byEntity = entityType ? ENTITY_MODULES[entityType.toUpperCase()] : undefined;
    entry = {
      module: byPrefix ?? byEntity ?? 'OTHER',
      type: guessType(action),
      text: `performed “${humanise(action)}” for {s} {r}`,
      label: humanise(action),
    };
  }

  const mod = AUDIT_MODULES[entry.module];
  const info: ActionInfo = {
    action,
    module: entry.module,
    moduleLabel: mod.label,
    tab: mod.tab,
    tabLabel: AUDIT_TABS.find((t) => t.id === mod.tab)!.label,
    type: entry.type,
    typeLabel: AUDIT_ACTION_TYPES[entry.type].label,
    label: entry.label ?? AUDIT_ACTION_TYPES[entry.type].past,
    text: entry.text,
    impersonal: !!entry.impersonal,
    outcome: /FAILED|_FAILURE|DENIED|BLOCKED|UNREGISTERED/.test(action) ? 'FAILURE' : 'SUCCESS',
    confidential: entry.module === 'MEDICAL',
    unmapped,
  };
  cache.set(key, info);
  return info;
}

export interface AuditFilterSpec {
  tab?: AuditTab | 'ALL';
  module?: AuditModule;
  actionType?: AuditActionType;
  outcome?: 'SUCCESS' | 'FAILURE';
}

/** Does an action belong in the tab and pass the module / type / result filters? */
export function matchesFilters(info: ActionInfo, f: AuditFilterSpec, opts: { ignoreTab?: boolean } = {}): boolean {
  if (!opts.ignoreTab) {
    const tab = f.tab ?? 'ALL';
    if (tab === 'ALL' ? info.tab === 'SECURITY' : info.tab !== tab) return false;
    if (f.module && info.module !== f.module) return false;
  }
  if (f.actionType && info.type !== f.actionType) return false;
  if (f.outcome && info.outcome !== f.outcome) return false;
  return true;
}

/** True when free text names an action, its label, type, module or tab. */
export function actionMatchesText(info: ActionInfo, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return [info.action.toLowerCase(), humanise(info.action).toLowerCase(), info.label, info.typeLabel, info.moduleLabel, info.tabLabel, info.text.replace(/\{[a-z]\}/g, '')]
    .some((hay) => hay.toLowerCase().includes(needle));
}

/**
 * The plain sentence for one event, e.g.
 * "Maria Santos approved the leave request “Vacation leave, 24–26 Sep 2026” of Juan Dela Cruz."
 */
export function summarize(
  info: ActionInfo,
  ctx: { actor: string | null; subject: string | null; subjectIsActor?: boolean; record: string | null }
): string {
  const actor = ctx.actor ?? 'System';
  let text = info.text;
  if (ctx.subject && !ctx.subjectIsActor) {
    text = text.replace('{s}', ctx.subject);
  } else if (ctx.subjectIsActor && /\bthe [^{]+?(?: \{r\})? of \{s\}/.test(text)) {
    // "updated the employee record of {s}" → "updated their own employee record"
    text = text.replace(/\bthe ([^{]+?)( \{r\})? of \{s\}/, (_m, noun: string, r?: string) => `their own ${noun}${r ?? ''}`);
  } else {
    text = text.replace(/\s+(of|for|with|to|on|from)\s+\{s\}/, '').replace('{s}', ctx.subjectIsActor ? 'themselves' : 'an employee');
  }
  text = ctx.record ? text.replace('{r}', `“${ctx.record}”`) : text.replace(/\s*\{r\}/, '');
  text = text.replace('{a}', actor);
  const sentence = info.impersonal ? text : `${actor} ${text}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`.replace(/\s+/g, ' ').replace(/ \./, '.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Field names, values and what may be shown
// ─────────────────────────────────────────────────────────────────────────────

/** Keys never shown at all (credentials, clinical and HR-confidential notes). */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'otp',
  'hrnotes',
  'hrconfidentialnotes',
  'confidential',
  'diagnosis',
  'findings',
];

export function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  // `otp` must not match words such as "footprint"; it is only ever a whole word or prefix.
  return SENSITIVE_KEY_FRAGMENTS.some((f) => (f === 'otp' ? /^otp|Otp/.test(key) : lowered.includes(f)));
}

/** Keys whose change is shown, but never the value (government ID numbers). */
const MASKED_KEYS = /^(sssNumber|philhealthNumber|pagibigNumber|tinNumber|otherGovernmentIds|otherGovernmentIdRows|governmentIds?)$/;

export function isMaskedKey(key: string): boolean {
  return MASKED_KEYS.test(key);
}

/** Bookkeeping keys that never help a reader. */
const IGNORED_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'recordVersion', 'script', 'migrationId', 'initiatedBy', 'success', 'bulkBatchId']);

/** Free text typed by a person: shown as written, never re-cased like a code. */
const FREE_TEXT_KEYS = /^(title|name|recordTitle|reason|remarks|note|notes|filename|originalFilename|fullName|description|overseer|oversees|jobRoleName|subject|label|firstName|lastName|middleName|.*Name|.*Title)$/;

export function isIgnoredKey(key: string): boolean {
  return IGNORED_KEYS.has(key);
}

const FIELD_LABELS: Record<string, string> = {
  sssNumber: 'SSS number',
  philhealthNumber: 'PhilHealth number',
  pagibigNumber: 'Pag-IBIG number',
  tinNumber: 'TIN',
  otherGovernmentIds: 'Other government IDs',
  otherGovernmentIdRows: 'Other government IDs',
  prcLicenseNumber: 'PRC license number',
  prcIssuedDate: 'PRC issue date',
  prcValidUntil: 'PRC valid until',
  ncCertificateNumber: 'NC certificate number',
  ncQualification: 'NC qualification',
  ncValidUntil: 'NC valid until',
  employmentStatus: 'Employment status',
  employmentState: 'Employee status',
  unit: 'Unit',
  dept: 'Department',
  jobRole: 'Job role',
  immediateSupervisor: 'Immediate supervisor',
  supervisor: 'Supervisor',
  evaluator: 'Evaluator',
  evaluators: 'Evaluators',
  targetEmployees: 'Employees looked up',
  biometricCode: 'Timekeeping code',
  hsjResidence: 'HSJ residence',
  photoUrl: 'Photo',
  emergencyContacts: 'Emergency contacts',
  emergencyContactRel: 'Emergency contact relationship',
  personalEmail: 'Personal email (sign-in)',
  totalAllotted: 'Days allotted',
  timeIn: 'Time in',
  timeOut: 'Time out',
  hoursWorked: 'Hours worked',
  overtimeHours: 'Overtime hours',
  isActive: 'Active',
  deletedAt: 'Archived on',
  publishAt: 'Publish date',
  recipientCount: 'Recipients',
  fileSizeBytes: 'File size',
  sizeBytes: 'File size',
  originalFilename: 'File name',
  mimeType: 'File type',
  overallScore: 'Overall score',
  combinedScore: 'Combined score',
  raterType: 'Rater',
  isEmployeeVisible: 'Visible to employee',
  completedYears: 'Completed years of service',
  self: 'Self weight (%)',
  peer: 'Peer weight (%)',
  head: 'Head weight (%)',
  fields: 'Changed fields',
};

/** "employmentStatus" → "Employment status"; "jobRoleId" → "Job role". */
export function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const base = key.replace(/Ids$/, 's').replace(/Id$/, '');
  if (FIELD_LABELS[base]) return FIELD_LABELS[base];
  const words = base
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Sections of the Employee Profile, for "updated the Contact Details of …". */
const EMPLOYEE_SECTIONS: Array<[string, string[]]> = [
  ['Personal Details', ['firstName', 'middleName', 'lastName', 'suffix', 'gender', 'dateOfBirth', 'placeOfBirth', 'civilStatus', 'nationality', 'religion', 'bloodType', 'spouseName', 'numberOfChildren', 'photoUrl']],
  ['Contact Details', ['personalEmail', 'mobilePhone', 'telephoneNumber', 'homePhone']],
  ['Addresses', ['presentAddress', 'permanentAddress', 'hsjResidence', 'residenceDorm']],
  ['Emergency Contacts', ['emergencyContactName', 'emergencyContactRel', 'emergencyContactPhone', 'emergencyContacts']],
  ['Employment Details', ['departmentId', 'unitId', 'jobRoleId', 'employmentStatus', 'employmentState', 'workSchedule', 'hireDate', 'probationDate', 'regularizationDate', 'separationDate', 'separationReason', 'biometricCode', 'paternityLeaveEligible', 'soloParentLeaveEligible']],
  ['Licenses & Education', ['prcLicenseNumber', 'professionalRole', 'prcIssuedDate', 'prcValidUntil', 'ncCertificateNumber', 'ncQualification', 'ncValidUntil', 'primarySchool', 'secondarySchool', 'tertiarySchool', 'tertiaryCourse', 'tertiaryGraduated', 'diploma', 'vocationalQualification']],
  ['Government IDs', ['sssNumber', 'philhealthNumber', 'pagibigNumber', 'tinNumber', 'otherGovernmentIds', 'otherGovernmentIdRows']],
];

/** Which profile sections a set of changed employee fields belongs to, in profile order. */
export function employeeSections(fields: string[]): string[] {
  return EMPLOYEE_SECTIONS.filter(([, keys]) => fields.some((f) => keys.includes(f))).map(([name]) => name);
}

/** Phrase for an employee update that names the sections, when known. */
export function employeeUpdateText(fields: string[]): string | null {
  const sections = employeeSections(fields);
  if (!sections.length) return null;
  if (sections.length === 1) return `updated the ${sections[0]} of {s}`;
  if (sections.length === 2) return `updated the ${sections[0]} and ${sections[1]} of {s}`;
  return `updated ${sections.length} sections (${sections.join(', ')}) of the employee record of {s}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function humanise(code: string): string {
  const s = code.replace(/_/g, ' ').toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MANILA_DATE = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: 'numeric', month: 'short', year: 'numeric' });
const MANILA_DATETIME = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDateValue(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const iso = d.toISOString();
  // Date-only values are stored as midnight UTC; show them without a time.
  return iso.endsWith('T00:00:00.000Z') ? MANILA_DATE.format(d) : MANILA_DATETIME.format(d);
}

/**
 * A stored value as a reader should see it. `names` resolves record ids
 * (employees, units, job roles…) to names; an id that cannot be resolved is
 * shown as "a record that no longer exists" rather than as a raw id.
 */
export function formatAuditValue(key: string, value: unknown, names: Map<string, string>): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (/size(bytes)?$/i.test(key)) return value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
    return String(value);
  }
  if (typeof value === 'string') {
    if (UUID.test(value)) return names.get(value) ?? 'A record that no longer exists';
    if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value)) return formatDateValue(value.length === 10 ? `${value}T00:00:00.000Z` : value);
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(value) && !FREE_TEXT_KEYS.test(key)) return humanise(value);
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    if (value.every((v) => typeof v === 'string')) {
      const shown = (value as string[]).map((v) => (isUuid(v) ? names.get(v) ?? 'a removed record' : key === 'fields' ? fieldLabel(v) : humanise(v)));
      return shown.length > 12 ? `${shown.slice(0, 12).join(', ')} and ${shown.length - 12} more` : shown.join(', ');
    }
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  return 'Details not shown';
}

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
  /** The value is confidential or an ID number: only the fact of the change is shown. */
  hidden: boolean;
}

export interface AuditDetail {
  label: string;
  value: string;
}

export interface ExtractedChanges {
  changes: AuditChange[];
  /** Field names reported as changed, where no values were recorded. */
  changedFields: string[];
  /** Values recorded on one side only — shown as recorded, never as a before/after. */
  recorded: { title: string; items: AuditDetail[] } | null;
  details: AuditDetail[];
}

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Turns a stored audit row into before/after changes and readable details —
 * using only what the row actually recorded. Nothing is inferred: a value that
 * was not stored is not shown as a "before".
 */
export function extractChanges(
  row: { metadata: unknown; oldValue: unknown; newValue: unknown },
  info: ActionInfo,
  names: Map<string, string>,
  opts: { submittedOnly?: boolean } = {}
): ExtractedChanges {
  const changes: AuditChange[] = [];
  const consumed = new Set<string>();
  const hideValues = info.confidential;

  const pushChange = (key: string, before: unknown, after: unknown) => {
    if (isSensitiveKey(key) || isIgnoredKey(key)) return;
    const hidden = hideValues || isMaskedKey(key);
    changes.push({
      field: key,
      label: fieldLabel(key),
      before: hidden ? '' : formatAuditValue(key, before, names),
      after: hidden ? '' : formatAuditValue(key, after, names),
      hidden,
    });
  };

  // A key stored on only one side is not a change (its other value was never
  // recorded); it is listed under "Also recorded" instead.
  const oneSided: Array<{ key: string; value: unknown; previous: boolean }> = [];
  const diffObjects = (before: Record<string, unknown>, after: Record<string, unknown>) => {
    for (const k of Object.keys(after)) {
      if (!(k in before)) oneSided.push({ key: k, value: after[k], previous: false });
      else if (!same(before[k], after[k])) pushChange(k, before[k], after[k]);
    }
    for (const k of Object.keys(before)) if (!(k in after)) oneSided.push({ key: k, value: before[k], previous: true });
  };

  const meta = asObject(row.metadata) ?? {};
  const oldV = asObject(row.oldValue);
  const newV = asObject(row.newValue);

  // 1. A recorded before and after snapshot.
  if (oldV && newV && !opts.submittedOnly) diffObjects(oldV, newV);

  // 2. metadata { before, after }.
  const mBefore = asObject(meta.before);
  const mAfter = asObject(meta.after);
  if (mBefore && mAfter) {
    diffObjects(mBefore, mAfter);
    consumed.add('before').add('after');
  }

  // 3. metadata pairs: previousX / newX, oldX / newX, previousX / x.
  for (const key of Object.keys(meta)) {
    const m = /^(previous|old)([A-Z].*)$/.exec(key);
    if (!m) continue;
    const base = m[2];
    const partner = [`new${base}`, lowerFirst(base)].find((k) => k in meta && k !== key);
    if (!partner) continue;
    consumed.add(key).add(partner);
    if (!same(meta[key], meta[partner])) pushChange(lowerFirst(base), meta[key], meta[partner]);
  }

  // Names of changed fields, where the row recorded only the names.
  const changedFields = Array.isArray(meta.fields)
    ? (meta.fields as unknown[]).filter((f): f is string => typeof f === 'string' && !isSensitiveKey(f)).map(fieldLabel)
    : [];
  consumed.add('fields');

  // Values recorded on one side only.
  let recorded: ExtractedChanges['recorded'] = null;
  const showable = ([k, v]: [string, unknown]) => !isSensitiveKey(k) && !isIgnoredKey(k) && !(isUuid(v) && !names.has(v as string));
  const item = (k: string, v: unknown, prefix = '') => ({
    label: `${prefix}${prefix ? fieldLabel(k).toLowerCase() : fieldLabel(k)}`,
    value: isMaskedKey(k) ? 'Recorded (value hidden)' : formatAuditValue(k, v, names),
  });
  const oneSide = opts.submittedOnly ? newV : oldV && newV ? null : newV ?? oldV;
  if (!hideValues) {
    let title = '';
    let items: AuditDetail[] = [];
    if (oneSide) {
      items = Object.entries(oneSide).filter(showable).map(([k, v]) => item(k, v));
      title = opts.submittedOnly ? 'Submitted values (earlier entries did not record the previous values)' : oldV && !newV ? 'Previous values' : 'Recorded values';
    } else if (oneSided.length) {
      items = oneSided.filter((o) => showable([o.key, o.value])).map((o) => item(o.key, o.value, o.previous ? 'Previous ' : ''));
      title = 'Also recorded';
    }
    if (items.length) recorded = { title, items: items.slice(0, 40) };
  }

  // Everything else in metadata, readable and safe.
  const details: AuditDetail[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (consumed.has(k) || isSensitiveKey(k) || isIgnoredKey(k) || v === null || v === undefined || v === '') continue;
    if (hideValues && k !== 'reviewStatus') continue;
    const ids = typeof v === 'string' ? [v] : Array.isArray(v) ? v : [];
    const idLike = ids.length > 0 && ids.every(isUuid);
    if (idLike && !ids.some((id) => names.has(id as string))) continue; // unresolvable ids say nothing
    if (asObject(v)) continue;
    details.push({ label: fieldLabel(k), value: isMaskedKey(k) ? 'Recorded (value hidden)' : formatAuditValue(k, v, names) });
  }

  return { changes, changedFields, recorded, details: details.slice(0, 16) };
}

/**
 * What actually changed between two snapshots of a record, for an audit row's
 * `oldValue` / `newValue` and `metadata.fields`. Only plain values are compared
 * (relations and JSON are the caller's business). A sensitive or ID-number
 * field is listed in `fields` but its values are never stored.
 */
export function auditSnapshotDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  ignore: string[] = ['createdAt', 'updatedAt']
) {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const fields: string[] = [];
  if (!before || !after) return { oldValue, newValue, fields };
  const plain = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
  const isPlain = (v: unknown) => v === null || v === undefined || v instanceof Date || typeof v !== 'object';
  for (const key of Object.keys(after)) {
    if (ignore.includes(key) || !isPlain(before[key]) || !isPlain(after[key])) continue;
    if (plain(before[key]) === plain(after[key])) continue;
    fields.push(key);
    if (isSensitiveKey(key) || isMaskedKey(key)) continue;
    oldValue[key] = plain(before[key]);
    newValue[key] = plain(after[key]);
  }
  return { oldValue, newValue, fields };
}

/** Every UUID found in a row's stored values (one level deep, plus string arrays). */
export function collectIds(...values: unknown[]): string[] {
  const out = new Set<string>();
  const visit = (v: unknown, depth: number) => {
    if (isUuid(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach((x) => isUuid(x) && out.add(x));
    else if (depth < 2) {
      const o = asObject(v);
      if (o) Object.entries(o).forEach(([k, x]) => !isSensitiveKey(k) && visit(x, depth + 1));
    }
  };
  values.forEach((v) => visit(v, 0));
  return Array.from(out);
}
