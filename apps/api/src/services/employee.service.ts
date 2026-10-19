import {
  assertLoginEmailAvailable, normalizeEmergencyContacts, normalizeGovernmentIds, normalizeLoginEmail,
  writeEmergencyContacts, writeGovernmentIds,
} from './employee-contact-details';
import { LeaveEntitlementService } from './leave-entitlement.service';
import { NO_SUPERVISOR_REQUIRED_ROLE_CODES, SupervisorResolverService } from './supervisor-resolver.service';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { OrgHierarchyService } from './org-hierarchy.service';
import { AdditionalOversightService } from './additional-oversight.service';
import { MAX_BULK_BATCH } from '../config/rate-limits';
import { validateEmployment, hasEnded } from '../lib/employment';
import { DocumentCategory, EmploymentStatus, PermissionTier } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { generateTemporaryPassword, hashPassword } from '../lib/password';
import {
  createEmployeeNumberCandidates,
  isEmployeeNumberConflict,
} from '../lib/employeeNumber';

/** Uploaded onboarding files, already written to disk by multer. */
export interface OnboardingUploadedFiles {
  profilePicture?: Express.Multer.File[];
  resume?: Express.Multer.File[];
  contract?: Express.Multer.File[];
  governmentIds?: Express.Multer.File[];
  otherDocuments?: Express.Multer.File[];
}

/**
 * Keys that must never reach the client through an audit timeline, matched
 * case-insensitively as substrings.
 */
const TIMELINE_REDACTED_KEYS = [
  'password',
  'passwordhash',
  'temporarypassword',
  'temppassword',
  'token',
  'secret',
  'apikey',
  'authorization',
  'hrnotes',
  'hrconfidentialnotes',
  'confidential',
  'diagnosis',
  'findings',
];

/** Strips credential-like and clinically confidential fields from audit metadata. */
function redactTimelineMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    if (TIMELINE_REDACTED_KEYS.some((banned) => lowered.includes(banned))) continue;
    // Only primitive values are surfaced — nested objects can hide sensitive data.
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

export interface CreateEmployeeResult {
  employee: any;
  /** Present only when a brand-new login account was actually created. */
  temporaryPassword: string | null;
  /** True when a linked User row was created in this request. */
  accountCreated: boolean;
  /** The email the account was created against, for HR feedback. */
  accountEmail: string | null;
  documentsSaved: number;
  warnings: string[];
}

// ─── Profile completion ────────────────────────────────────────────────────────
// The percentage AND the missing-information list now come from one criteria
// table in `profile-completion.ts`. They used to be two functions that counted
// different things. Re-exported here because the controllers and the export
// builders already import them from this module.
import {
  calculateProfileCompletion,
  listMissingProfileFields,
  getProfileCompletion,
} from './profile-completion';
import { normalizeRecordFields, recordFieldsForCreate } from '../lib/employee-record-fields';

export {
  calculateProfileCompletion,
  listMissingProfileFields,
  getProfileCompletion,
} from './profile-completion';

/** A date the caller omitted stays as it is; one they cleared becomes null. */
function toNullableDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) throw new AppError('One of the dates could not be read.', 400);
  return d;
}

/**
 * The employee list search, one condition per word: every word must appear
 * somewhere in the person's name, employee number, timekeeping code, email, job
 * role, unit or department. So "Juan Cruz", "Cruz Juan" and "Cruz, Juan" all
 * find the same person, and stray spaces don't matter. "%" and "_" are escaped
 * so they are searched for as typed instead of matching everyone.
 */
function employeeSearchConditions(search: unknown): any[] {
  const words = String(search ?? '').split(/[\s,]+/).filter(Boolean).slice(0, 8);
  return words.map((word) => {
    const q = word.replace(/[\\%_]/g, (c) => `\\${c}`);
    return {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { middleName: { contains: q } },
        { suffix: { contains: q } },
        { employeeNumber: { contains: q } },
        { biometricCode: { contains: q } },
        { personalEmail: { contains: q } },
        { user: { email: { contains: q } } },
        { jobRole: { title: { contains: q } } },
        { department: { name: { contains: q } } },
        { unit: { name: { contains: q } } },
      ],
    };
  });
}

export class EmployeeService {
  /**
   * List employees — HR sees all, supervisors see direct reports + own profile, standard sees own profile.
   */
  static async list(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      unitId?: string;
      status?: string;
      departmentId?: string;
      jobRoleId?: string;
      immediateSupervisorId?: string;
      employmentState?: string;
      accountStatus?: string;
      supervisorAssignmentStatus?: string;
      supervisorAssignmentSource?: string;
      hireDateFrom?: string;
      hireDateTo?: string;
      isArchived?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const {
      page = 1, limit = 25, search, unitId, status,
      departmentId, jobRoleId, immediateSupervisorId,
      employmentState, accountStatus, supervisorAssignmentStatus,
      supervisorAssignmentSource, hireDateFrom, hireDateTo,
      isArchived, sortBy, sortOrder
    } = params;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(pageNum) || pageNum < 1 || !Number.isInteger(pageNum)) {
      throw new AppError('Page must be a positive integer', 400);
    }

    // Limit must be 1-1000 for listings, or exactly 5000 (which is the approved export limit)
    if (limitNum !== 5000) {
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000 || !Number.isInteger(limitNum)) {
        throw new AppError('Limit must be an integer between 1 and 1000', 400);
      }
    }

    const skip = (pageNum - 1) * limitNum;

    if (permissionTier === PermissionTier.FULL) {
      // HR full access
    } else if (permissionTier === PermissionTier.SUPERVISOR) {
      const include = {
        // departmentId: profile completion needs to know whether a department can apply.
        jobRole: { select: { id: true, title: true, departmentId: true } },
        unit: { select: { id: true, name: true, departmentId: true } },
        department: { select: { id: true, name: true } },
        immediateSupervisor: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { title: true } } } },
        user: { select: { id: true, email: true, isActive: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
      };
      const supervisorWhere: any = {
        OR: [
          { id: requestingEmployeeId },
          { immediateSupervisorId: requestingEmployeeId, deletedAt: null },
        ],
      };
      const andConditions: any[] = [...employeeSearchConditions(search)];

      if (unitId) andConditions.push({ unitId });
      if (departmentId) andConditions.push({ departmentId });
      if (jobRoleId) andConditions.push({ jobRoleId });
      if (immediateSupervisorId) andConditions.push({ immediateSupervisorId });
      if (status) andConditions.push({ employmentStatus: status as any });
      if (employmentState) andConditions.push({ employmentState: employmentState as any });
      if (supervisorAssignmentStatus) andConditions.push({ supervisorAssignmentStatus: supervisorAssignmentStatus as any });
      if (supervisorAssignmentSource) andConditions.push({ supervisorAssignmentSource: supervisorAssignmentSource as any });

      if (hireDateFrom || hireDateTo) {
        const dateCond: any = {};
        if (hireDateFrom) dateCond.gte = new Date(hireDateFrom);
        if (hireDateTo) dateCond.lte = new Date(hireDateTo);
        andConditions.push({ hireDate: dateCond });
      }

      if (accountStatus === 'ACTIVE') {
        andConditions.push({ user: { isNot: null, isActive: true } });
      } else if (accountStatus === 'INACTIVE') {
        andConditions.push({ user: { isNot: null, isActive: false } });
      } else if (accountStatus === 'NO_ACCOUNT') {
        andConditions.push({ user: null });
      }

      if (isArchived === 'true' || isArchived === 'only') {
        andConditions.push({ deletedAt: { not: null } });
      } else if (isArchived === 'all') {
        // Active and archived
      } else {
        andConditions.push({ deletedAt: null });
      }

      if (andConditions.length > 0) {
        supervisorWhere.AND = andConditions;
      }
      const [rawList, total] = await Promise.all([
        prisma.employee.findMany({
          where: supervisorWhere, include,
          skip: skip, take: limitNum, orderBy: { firstName: 'asc' }
        }),
        prisma.employee.count({ where: supervisorWhere }),
      ]);

      // A supervisor's list carries the work view only — the same fields as the
      // team-member profile — never their reports' personal record.
      const data = rawList.map((emp) =>
        EmployeeService.toTeamMemberView({ ...emp, profileCompletion: calculateProfileCompletion(emp) })
      );

      return { data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
    } else {
      const employee = await prisma.employee.findUnique({
        where: { id: requestingEmployeeId },
        include: {
          unit: true,
          jobRole: true,
          department: true,
          immediateSupervisor: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { title: true } } } },
          user: { select: { id: true, email: true, isActive: true } },
          documents: { where: { deletedAt: null }, select: { id: true } },
        },
      });
      const data = employee ? [{ ...employee, profileCompletion: calculateProfileCompletion(employee) }] : [];
      return { data, total: data.length, page: 1, limit, pages: 1 };
    }

    const where: any = {};

    if (isArchived === 'true' || isArchived === 'only') {
      where.deletedAt = { not: null };
    } else if (isArchived === 'all') {
      // Active and archived
    } else {
      where.deletedAt = null;
    }

    const searchConditions = employeeSearchConditions(search);
    if (searchConditions.length) where.AND = searchConditions;

    if (unitId) where.unitId = unitId;
    if (departmentId) where.departmentId = departmentId;
    if (jobRoleId) where.jobRoleId = jobRoleId;
    if (immediateSupervisorId) where.immediateSupervisorId = immediateSupervisorId;
    if (status) where.employmentStatus = status as any;
    if (employmentState) where.employmentState = employmentState as any;
    if (supervisorAssignmentStatus) where.supervisorAssignmentStatus = supervisorAssignmentStatus as any;
    if (supervisorAssignmentSource) where.supervisorAssignmentSource = supervisorAssignmentSource as any;

    if (hireDateFrom || hireDateTo) {
      where.hireDate = {};
      if (hireDateFrom) where.hireDate.gte = new Date(hireDateFrom);
      if (hireDateTo) where.hireDate.lte = new Date(hireDateTo);
    }

    if (accountStatus === 'ACTIVE') {
      where.user = { isNot: null, isActive: true };
    } else if (accountStatus === 'INACTIVE') {
      where.user = { isNot: null, isActive: false };
    } else if (accountStatus === 'NO_ACCOUNT') {
      where.user = null;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy) {
      if (['employeeNumber', 'firstName', 'lastName', 'hireDate', 'employmentStatus', 'employmentState', 'createdAt'].includes(sortBy)) {
        orderBy = { [sortBy]: sortOrder || 'asc' };
      } else if (sortBy === 'jobRole') {
        orderBy = { jobRole: { title: sortOrder || 'asc' } };
      } else if (sortBy === 'department') {
        orderBy = { department: { name: sortOrder || 'asc' } };
      } else if (sortBy === 'unit') {
        orderBy = { unit: { name: sortOrder || 'asc' } };
      } else if (sortBy === 'supervisor') {
        orderBy = { immediateSupervisor: { lastName: sortOrder || 'asc' } };
      }
    }

    const [rawList, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          // departmentId: profile completion needs to know whether a department can apply.
          jobRole: { select: { id: true, title: true, departmentId: true, code: true } },
          unit: { select: { id: true, name: true, departmentId: true } },
          department: { select: { id: true, name: true } },
          immediateSupervisor: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { title: true } } }
          },
          user: { select: { id: true, email: true, isActive: true } },
          documents: { where: { deletedAt: null }, select: { id: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    let data = rawList.map((emp) => ({
      ...emp,
      // Top-level roles (HR Officer, Sister) show "Not required", not "Not yet assigned".
      noSupervisorRequired: NO_SUPERVISOR_REQUIRED_ROLE_CODES.includes(emp.jobRole?.code ?? ''),
      profileCompletion: calculateProfileCompletion(emp),
    }));

    if (sortBy === 'profileCompletion') {
      data = data.sort((a, b) =>
        sortOrder === 'desc' ? b.profileCompletion - a.profileCompletion : a.profileCompletion - b.profileCompletion
      );
    }

    return { data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  /**
   * Audit history for one employee, for the 201 profile Timeline tab.
   *
   * Combines events where the employee is the audit target and events recorded
   * directly against their record. Metadata is redacted: anything that looks like
   * a credential, token, hash or confidential clinical note is stripped before it
   * leaves the server.
   */
  static async getTimeline(employeeId: string, limit = 50) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, user: { select: { id: true } } },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const orFilters: any[] = [
      { targetEmployeeId: employeeId },
      { entityType: 'EMPLOYEE', entityId: employeeId },
    ];
    if (employee.user?.id) {
      orFilters.push({ entityType: 'USER', entityId: employee.user.id });
    }

    const logs = await prisma.auditLog.findMany({
      where: { OR: orFilters },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actorUser: {
          select: {
            email: true,
            employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt,
      actor: log.actorUser
        ? {
            name: log.actorUser.employee
              ? `${log.actorUser.employee.firstName} ${log.actorUser.employee.lastName}`.trim()
              : log.actorUser.email,
            employeeNumber: log.actorUser.employee?.employeeNumber ?? null,
          }
        : null,
      metadata: redactTimelineMetadata(log.metadata),
    }));
  }

  /**
   * Full profile for the 201 file.
   *
   * `documents` is deliberately id-only: it exists so profile completion can
   * count what has been filed, NOT so the profile page can render a document
   * list. Document metadata is served by `GET /employees/:employeeId/documents`,
   * which applies the per-viewer visibility rules (an employee sees only what is
   * marked visible to them, a supervisor only what is marked visible to
   * supervisors). Widening this include would hand every viewer metadata for
   * documents they are not allowed to see.
   */
  static async getById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        unit: true,
        jobRole: true,
        // Account status drives the Account Management panel (lock state, forced
        // password change, last sign-in). Selecting only id/email/isActive left
        // that panel permanently showing "Never" and hid the Unlock action even
        // for a locked account. No credential material is selected.
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            lockedUntil: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        immediateSupervisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobRole: { select: { title: true } },
          },
        },
        documents: { where: { deletedAt: null }, select: { id: true } },
        emergencyContacts: { orderBy: { position: 'asc' } },
        governmentIds: { orderBy: { position: 'asc' } },
      },
    });

    if (!employee) throw new AppError('Employee not found', 404);

    const completion = getProfileCompletion(employee);
    return {
      ...employee,
      // Accounts created before the personal email became the login may still
      // sign in with an older address; HR can switch them (account panel).
      noSupervisorRequired: NO_SUPERVISOR_REQUIRED_ROLE_CODES.includes(employee.jobRole?.code ?? ''),
      loginEmailMatchesPersonalEmail:
        !employee.user || !employee.personalEmail
          ? null
          : employee.user.email.toLowerCase() === employee.personalEmail.toLowerCase(),
      profileCompletion: completion.percentage,
      missingFields: completion.missing,
      missingFieldIds: completion.missingIds,
      missingFieldGroups: completion.missingGroups,
      profileCompletionBreakdown: completion.breakdown,
    };
  }

  /**
   * What a supervisor sees of a direct report (My Team): the WORK profile —
   * identity, job role, unit, employment status and dates, reporting line,
   * profile completion. Never the personal record: birth details, civil status,
   * religion, phones, emails, addresses, government IDs, PRC license number,
   * emergency contacts, leave-eligibility flags, timekeeping code, account
   * details or HR notes. Only HR (FULL) and the employee themselves get those
   * (`OrgHierarchyService.canViewFullEmployeeRecord`).
   *
   * Built as an allow-list, so a column added to Employee later stays private
   * until someone decides otherwise.
   */
  static toTeamMemberView(emp: any) {
    if (!emp) return emp;
    const pick = (o: any, keys: string[]) =>
      o ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : null;
    return {
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      middleName: emp.middleName ?? null,
      lastName: emp.lastName,
      suffix: emp.suffix ?? null,
      photoUrl: emp.photoUrl ?? null,
      bannerUrl: emp.bannerUrl ?? null,
      jobRoleId: emp.jobRoleId ?? null,
      unitId: emp.unitId ?? null,
      departmentId: emp.departmentId ?? null,
      jobRole: pick(emp.jobRole, ['id', 'code', 'title', 'permissionTier']),
      unit: pick(emp.unit, ['id', 'code', 'name']),
      department: pick(emp.department, ['id', 'code', 'name']),
      employmentStatus: emp.employmentStatus ?? null,
      employmentState: emp.employmentState ?? null,
      hireDate: emp.hireDate ?? null,
      probationDate: emp.probationDate ?? null,
      regularizationDate: emp.regularizationDate ?? null,
      separationDate: emp.separationDate ?? null,
      professionalRole: emp.professionalRole ?? null,
      // Whether a PRC license is on file — not the number.
      isProfessional: !!(emp.prcLicenseNumber && String(emp.prcLicenseNumber).trim()),
      immediateSupervisorId: emp.immediateSupervisorId ?? null,
      immediateSupervisor: emp.immediateSupervisor
        ? pick(emp.immediateSupervisor, ['id', 'firstName', 'lastName', 'employeeNumber', 'jobRole'])
        : null,
      supervisorAssignmentStatus: emp.supervisorAssignmentStatus ?? null,
      deletedAt: emp.deletedAt ?? null,
      // Whether they can sign in at all (the directory's Account Status column).
      user: emp.user ? { isActive: !!emp.user.isActive } : null,
      profileCompletion: emp.profileCompletion ?? null,
      viewScope: 'TEAM_MEMBER' as const,
    };
  }

  /**
   * Profile completion breakdown for one employee — the same calculation the
   * profile, directory and exports use. Callers must authorise access first.
   */
  static async getProfileCompletionBreakdown(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        unit: { select: { departmentId: true } },
        jobRole: { select: { departmentId: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    const completion = getProfileCompletion(employee);
    return {
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      percentage: completion.percentage,
      missing: completion.missing,
      breakdown: completion.breakdown,
    };
  }

  /**
   * Creates an employee, their linked login account and any onboarding documents
   * in ONE transaction.
   *
   * Guarantees:
   *  • `employeeNumber` is generated server-side (HSJ-XXXX) and never supplied by HR.
   *  • Employee + User are created atomically — a partial employee with no account
   *    can no longer be produced.
   *  • The temporary password is crypto-generated, hashed before storage, and the
   *    plaintext is returned exactly once to the authorised HR caller.
   *  • Uploaded documents are persisted with the employee; if the transaction
   *    fails the caller removes the orphaned files from disk.
   */
  static async create(
    data: any,
    requestingUserId?: string,
    uploaded?: OnboardingUploadedFiles
  ): Promise<CreateEmployeeResult> {
    const warnings: string[] = [];

    // ── Required-field validation (mirrors the non-nullable Prisma columns) ────
    const missing: string[] = [];
    const requireField = (value: unknown, label: string) => {
      if (value === undefined || value === null || String(value).trim() === '') missing.push(label);
    };
    requireField(data.firstName, 'First name');
    requireField(data.lastName, 'Last name');
    requireField(data.gender, 'Sex');
    requireField(data.dateOfBirth, 'Date of birth');
    requireField(data.civilStatus, 'Civil status');
    requireField(data.mobilePhone, 'Mobile number');
    requireField(data.presentAddress, 'Present address');
    requireField(data.unitId, 'Unit');
    requireField(data.jobRoleId, 'Job role');
    requireField(data.hireDate, 'Hire date');
    // End date / reason rules (see lib/employment.ts).
    validateEmployment(data);
    // Optional HSJ record fields: blanks become null; PRC / NC / spouse rules.
    normalizeRecordFields(data);

    // Up to three emergency contacts; the first is required.
    const emergencyContacts = normalizeEmergencyContacts(data.emergencyContacts, data) ?? [];
    if (!emergencyContacts.length) {
      missing.push('Emergency contact 1 (contact person, relationship and mobile number)');
    }
    const governmentIdRows = normalizeGovernmentIds(data.otherGovernmentIdRows) ?? [];

    // The personal email IS the login email — one address, one source.
    const loginEmail = normalizeLoginEmail(data.personalEmail);
    if (!loginEmail) {
      missing.push('Personal email (it is also the HRISense login)');
    }

    // Optional HR override of the automatically resolved supervisor.
    const overrideSupervisorId = typeof data.supervisorOverrideId === 'string' ? data.supervisorOverrideId.trim() : '';
    const overrideReason = typeof data.supervisorOverrideReason === 'string' ? data.supervisorOverrideReason.trim() : '';
    if (overrideSupervisorId && !overrideReason) {
      missing.push('Reason for changing the resolved supervisor');
    }

    if (missing.length > 0) {
      throw new AppError(
        `Please complete the following before finalising onboarding: ${missing.join(', ')}.`,
        400
      );
    }

    // ── Uniqueness pre-checks (fast, friendly errors before the transaction) ───
    await assertLoginEmailAvailable(loginEmail!);

    if (overrideSupervisorId) {
      const target = await prisma.employee.findFirst({
        where: { id: overrideSupervisorId, deletedAt: null, employmentState: { notIn: ['RESIGNED', 'TERMINATED', 'RETIRED', 'AWOL', 'OTHERS'] } },
        select: { id: true },
      });
      if (!target) throw new AppError('The selected supervisor is not an active employee.', 400);
    }

    // ── Organizational consistency ────────────────────────────────────────────
    if (data.unitId && data.jobRoleId) {
      const targetRole = await prisma.jobRole.findUnique({ where: { id: data.jobRoleId } });
      if (!targetRole) {
        throw new AppError('The selected Job Role does not exist.', 400);
      }
      // An organisation-wide role (no unit, e.g. Sister) may be held in any unit.
      if (targetRole.unitId && targetRole.unitId !== data.unitId) {
        throw new AppError('The selected Job Role does not belong to the selected Unit.', 400);
      }
      if (data.departmentId && targetRole.departmentId && targetRole.departmentId !== data.departmentId) {
        throw new AppError('The selected Job Role does not belong to the selected Department.', 400);
      }
    }

    const resolver = new SupervisorResolverService();
    const resolution = await resolver.resolveForEmployee('new', data.jobRoleId);

    // ── Credentials ───────────────────────────────────────────────────────────
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    // ── Documents to persist alongside the employee ───────────────────────────
    const documentPlan = EmployeeService.buildOnboardingDocumentPlan(uploaded);
    const profilePhoto = uploaded?.profilePicture?.[0];

    // ── Atomic creation with employee-number retry ────────────────────────────
    const candidates = await createEmployeeNumberCandidates(6);
    let created: any = null;
    let lastConflict: unknown = null;

    for (const employeeNumber of candidates) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const employee = await tx.employee.create({
            data: {
              employeeNumber,
              firstName: data.firstName,
              middleName: data.middleName || null,
              lastName: data.lastName,
              suffix: data.suffix || null,
              gender: data.gender,
              dateOfBirth: new Date(data.dateOfBirth),
              placeOfBirth: data.placeOfBirth || null,
              civilStatus: data.civilStatus,
              nationality: data.nationality || 'Filipino',
              religion: data.religion || null,
              personalEmail: loginEmail,
              mobilePhone: data.mobilePhone,
              telephoneNumber: data.telephoneNumber || null,
              homePhone: data.homePhone || null,
              presentAddress: data.presentAddress,
              permanentAddress: data.permanentAddress || null,
              // Mirror of emergency contact #1 (see employee-contact-details).
              emergencyContactName: emergencyContacts[0]?.contactName ?? '',
              emergencyContactRel: emergencyContacts[0]?.relationship ?? '',
              emergencyContactPhone: emergencyContacts[0]?.mobilePhone ?? '',
              unitId: data.unitId,
              departmentId: data.departmentId || null,
              jobRoleId: data.jobRoleId,
              employmentStatus: data.employmentStatus || 'REGULAR',
              employmentState: data.employmentState || 'ACTIVE',
              hireDate: new Date(data.hireDate),
              probationDate: data.probationDate ? new Date(data.probationDate) : null,
              regularizationDate: data.regularizationDate ? new Date(data.regularizationDate) : null,
              separationDate: hasEnded(data.employmentState) && data.separationDate ? new Date(data.separationDate) : null,
              separationReason: hasEnded(data.employmentState) ? (data.separationReason || null) : null,
              prcLicenseNumber: data.prcLicenseNumber || null,
              professionalRole: data.professionalRole || null,
              ...recordFieldsForCreate(data),
              sssNumber: data.sssNumber || null,
              philhealthNumber: data.philhealthNumber || null,
              pagibigNumber: data.pagibigNumber || null,
              tinNumber: data.tinNumber || null,
              // Legacy free text is only kept when an older client sends it
              // instead of rows; new onboarding sends rows.
              otherGovernmentIds:
                !governmentIdRows.length && typeof data.otherGovernmentIds === 'string' && data.otherGovernmentIds.trim()
                  ? data.otherGovernmentIds.trim()
                  : null,
              paternityLeaveEligible: data.paternityLeaveEligible === true || data.paternityLeaveEligible === 'true',
              soloParentLeaveEligible: data.soloParentLeaveEligible === true || data.soloParentLeaveEligible === 'true',
              // Set after the photo document row exists (see the update below).
              photoUrl: null,
              // Automatic resolution, unless HR chose a different supervisor.
              ...(overrideSupervisorId
                ? {
                    immediateSupervisorId: overrideSupervisorId,
                    supervisorAssignmentStatus: 'ASSIGNED' as const,
                    supervisorAssignmentSource: 'MANUAL_OVERRIDE' as const,
                    supervisorPendingReason: null,
                    supervisorOverrideReason: overrideReason,
                    supervisorOverrideById: requestingUserId ?? null,
                    supervisorOverrideAt: new Date(),
                  }
                : {
                    immediateSupervisorId: resolution.supervisorId,
                    supervisorAssignmentStatus: resolution.assignmentStatus,
                    supervisorAssignmentSource: resolution.assignmentSource as any,
                    supervisorPendingReason: resolution.pendingReason,
                  }),
            },
          });

          await writeEmergencyContacts(tx, employee.id, emergencyContacts);
          await writeGovernmentIds(tx, employee.id, governmentIdRows);

          if (overrideSupervisorId) {
            await tx.auditLog.create({
              data: {
                action: 'SUPERVISOR_OVERRIDE_APPLIED',
                entityType: 'EMPLOYEE',
                entityId: employee.id,
                actorUserId: requestingUserId ?? null,
                targetEmployeeId: employee.id,
                metadata: {
                  during: 'ONBOARDING',
                  supervisorId: overrideSupervisorId,
                  reason: overrideReason,
                  automaticSupervisorId: resolution.supervisorId,
                  automaticStatus: resolution.assignmentStatus,
                  automaticPendingReason: resolution.pendingReason,
                },
              },
            });
          }

          // Linked login account — created in the same transaction.
          const user = await tx.user.create({
            data: {
              email: loginEmail!,
              passwordHash,
              employeeId: employee.id,
              isActive: true,
              isEmailVerified: false,
              mustChangePassword: true,
            },
          });

          // Onboarding documents (metadata only — files are already on disk).
          for (const plan of documentPlan) {
            await tx.employeeDocument.create({
              data: {
                employeeId: employee.id,
                category: plan.category,
                originalFilename: plan.file.originalname,
                storedFilename: plan.file.filename,
                mimeType: plan.file.mimetype,
                sizeBytes: plan.file.size,
                isVisibleToEmployee: plan.isVisibleToEmployee,
                isVisibleToSupervisor: plan.isVisibleToSupervisor,
                notes: plan.notes,
                uploadedById: requestingUserId ?? null,
              },
            });
          }

          // The profile photo is stored as a protected document too, and the
          // employee's photoUrl points at the authenticated stream route.
          let photoDocumentId: string | null = null;
          if (profilePhoto) {
            const photoDoc = await tx.employeeDocument.create({
              data: {
                employeeId: employee.id,
                category: DocumentCategory.OTHER,
                originalFilename: profilePhoto.originalname,
                storedFilename: profilePhoto.filename,
                mimeType: profilePhoto.mimetype,
                sizeBytes: profilePhoto.size,
                isVisibleToEmployee: true,
                isVisibleToSupervisor: true,
                notes: 'Profile photo captured during onboarding',
                uploadedById: requestingUserId ?? null,
              },
            });
            photoDocumentId = photoDoc.id;
          }

          const finalEmployee = await tx.employee.update({
            where: { id: employee.id },
            data: {
              photoUrl: photoDocumentId ? `/documents/${photoDocumentId}/preview` : null,
            },
            include: {
              unit: true,
              department: true,
              jobRole: true,
              immediateSupervisor: true,
              documents: { where: { deletedAt: null }, select: { id: true } },
              user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'EMPLOYEE_CREATED',
              entityType: 'EMPLOYEE',
              entityId: employee.id,
              actorUserId: requestingUserId ?? null,
              targetEmployeeId: employee.id,
              metadata: {
                employeeNumber: finalEmployee.employeeNumber,
                fullName: `${finalEmployee.firstName} ${finalEmployee.lastName}`,
                accountEmail: user.email,
                documentsSaved: documentPlan.length + (profilePhoto ? 1 : 0),
              },
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'USER_ACCOUNT_CREATED',
              entityType: 'USER',
              entityId: user.id,
              actorUserId: requestingUserId ?? null,
              targetEmployeeId: employee.id,
              metadata: { email: user.email, mustChangePassword: true },
            },
          });

          return finalEmployee;
        });
        break; // success
      } catch (err) {
        if (isEmployeeNumberConflict(err)) {
          lastConflict = err;
          continue; // another request grabbed this number — try the next candidate
        }
        throw err;
      }
    }

    if (!created) {
      console.error('[EmployeeService.create] Exhausted employee number candidates', lastConflict);
      throw new AppError(
        'Could not allocate a unique employee number. Please try finalising onboarding again.',
        409
      );
    }

    if (resolution.assignmentStatus === 'PENDING' && !overrideSupervisorId) {
      warnings.push(
        'No immediate supervisor could be resolved automatically. The employee is flagged as pending supervisor assignment.'
      );
    }

    // Completed-years leave entitlement for the new employee (never rolls back the record).
    try {
      await LeaveEntitlementService.syncEmployee(created.id, { actorUserId: requestingUserId ?? null });
    } catch (err) {
      console.warn('[EmployeeService.create] Leave entitlement could not be applied:', err);
      warnings.push('Leave entitlement could not be applied yet; it will be applied when the balances are next opened.');
    }

    return {
      employee: { ...created, profileCompletion: calculateProfileCompletion(created) },
      temporaryPassword,
      accountCreated: true,
      accountEmail: loginEmail,
      documentsSaved: documentPlan.length + (profilePhoto ? 1 : 0),
      warnings,
    };
  }

  /**
   * Maps the onboarding upload fields onto EmployeeDocument categories and the
   * per-document visibility rules used everywhere else in HRISense.
   */
  private static buildOnboardingDocumentPlan(uploaded?: OnboardingUploadedFiles) {
    const plan: Array<{
      file: Express.Multer.File;
      category: DocumentCategory;
      isVisibleToEmployee: boolean;
      isVisibleToSupervisor: boolean;
      notes: string;
    }> = [];

    for (const file of uploaded?.resume ?? []) {
      plan.push({
        file,
        category: DocumentCategory.RESUME,
        isVisibleToEmployee: true,
        isVisibleToSupervisor: false,
        notes: 'Uploaded during onboarding',
      });
    }
    for (const file of uploaded?.contract ?? []) {
      plan.push({
        file,
        category: DocumentCategory.EMPLOYMENT_CONTRACT,
        isVisibleToEmployee: true,
        isVisibleToSupervisor: false,
        notes: 'Uploaded during onboarding',
      });
    }
    for (const file of uploaded?.governmentIds ?? []) {
      plan.push({
        file,
        category: DocumentCategory.GOVERNMENT_ID,
        isVisibleToEmployee: true,
        isVisibleToSupervisor: false,
        notes: 'Uploaded during onboarding',
      });
    }
    for (const file of uploaded?.otherDocuments ?? []) {
      plan.push({
        file,
        category: DocumentCategory.OTHER,
        isVisibleToEmployee: true,
        isVisibleToSupervisor: false,
        notes: 'Uploaded during onboarding',
      });
    }

    return plan;
  }

  /** `undefined` leaves a date untouched; `null` or "" clears it. */
  private static readonly _dateDoc = true;

  static async update(
    id: string,
    data: any,
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    requestingUserId?: string
  ) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new AppError('Employee not found', 404);

    if (permissionTier !== PermissionTier.FULL) {
      if (id !== requestingEmployeeId) {
        throw new AppError('You can only update your own profile', 403);
      }
      // The personal email is the login address, so only HR changes it.
      const allowed = ['mobilePhone', 'homePhone', 'presentAddress',
        'permanentAddress', 'emergencyContacts', 'emergencyContactName', 'emergencyContactRel',
        'emergencyContactPhone', 'religion', 'photoUrl'];
      const filtered: any = {};
      allowed.forEach((key) => {
        if (key in data) filtered[key] = (data as any)[key];
      });
      data = filtered;
    }

    // End date / reason rules, judged on the merged result so a partial edit is
    // still validated as a whole. HR-only fields, so skip for self-service edits.
    if (permissionTier === PermissionTier.FULL) {
      validateEmployment(data, employee);
      // Optional HSJ record fields, judged on the merged record.
      normalizeRecordFields(data, employee);
      // Moving back to ACTIVE / ON_LEAVE clears the ending details.
      if (data.employmentState !== undefined && !hasEnded(data.employmentState)) {
        data.separationDate = null;
        data.separationReason = null;
      }
    }

    if (permissionTier === PermissionTier.FULL) {
      // A bad enum value would otherwise surface as an opaque database error.
      if (data.employmentStatus !== undefined) {
        const allowed = Object.values(EmploymentStatus) as string[];
        if (!allowed.includes(String(data.employmentStatus))) {
          throw new AppError('That employment type is not one of the available options.', 400);
        }
      }
      // The timekeeping code is unique across employees; say so plainly rather
      // than letting a unique-constraint violation reach the user.
      if (data.biometricCode !== undefined) {
        const code = String(data.biometricCode ?? '').trim();
        data.biometricCode = code || null;
        if (code) {
          const clash = await prisma.employee.findFirst({
            where: { biometricCode: code, NOT: { id } },
            select: { employeeNumber: true },
          });
          if (clash) {
            throw new AppError(`Timekeeping code ${code} is already assigned to employee ${clash.employeeNumber}.`, 409);
          }
        }
      }
    }

    delete data.immediateSupervisorId;
    delete data.supervisorAssignmentStatus;
    delete data.supervisorAssignmentSource;
    delete data.supervisorPendingReason;
    // Work email is no longer collected; the legacy column is never written.
    delete data.workEmail;
    delete data.otherGovernmentIds;
    // The legacy free text is retired only when HR has copied it into rows.
    if (data.clearLegacyOtherGovernmentIds === true && permissionTier === PermissionTier.FULL) {
      data.otherGovernmentIds = null;
    }
    delete data.clearLegacyOtherGovernmentIds;

    // Emergency contacts: the full list (up to three) replaces the stored rows.
    // An older client that edits only the single legacy fields updates contact #1
    // and leaves contacts #2 and #3 alone.
    const contactList = normalizeEmergencyContacts(data.emergencyContacts);
    delete data.emergencyContacts;
    const legacyContactEdit =
      contactList === undefined &&
      ['emergencyContactName', 'emergencyContactRel', 'emergencyContactPhone'].some((k) => k in data);
    if (contactList !== undefined) {
      if (!contactList.length) throw new AppError('Emergency contact 1 is required.', 400);
      data.emergencyContactName = contactList[0].contactName;
      data.emergencyContactRel = contactList[0].relationship;
      data.emergencyContactPhone = contactList[0].mobilePhone;
    }

    // Other government IDs (HR only): rows replace rows.
    const governmentIdRows = permissionTier === PermissionTier.FULL ? normalizeGovernmentIds(data.otherGovernmentIdRows) : undefined;
    delete data.otherGovernmentIdRows;

    // Leave eligibility flags (HR only), stored as booleans.
    for (const flag of ['paternityLeaveEligible', 'soloParentLeaveEligible'] as const) {
      if (flag in data) {
        if (permissionTier !== PermissionTier.FULL) delete data[flag];
        else data[flag] = data[flag] === true || data[flag] === 'true';
      }
    }
    const eligibilityChanged =
      (data.paternityLeaveEligible !== undefined && data.paternityLeaveEligible !== employee.paternityLeaveEligible) ||
      (data.soloParentLeaveEligible !== undefined && data.soloParentLeaveEligible !== employee.soloParentLeaveEligible);
    const hireDateChanged =
      data.hireDate !== undefined && data.hireDate && new Date(data.hireDate).getTime() !== new Date(employee.hireDate).getTime();

    // Personal email = login email. HR changing it changes the login too.
    let newLoginEmail: string | null = null;
    if (data.personalEmail !== undefined) {
      const email = normalizeLoginEmail(data.personalEmail);
      if (!email) throw new AppError('Personal email is required — it is the HRISense login.', 400);
      if ((employee.personalEmail ?? '').toLowerCase() !== email.toLowerCase()) {
        await assertLoginEmailAvailable(email, id);
        newLoginEmail = email;
      }
      data.personalEmail = email;
    }

    const orgChanged =
      (data.unitId !== undefined && data.unitId !== employee.unitId) ||
      (data.departmentId !== undefined && data.departmentId !== employee.departmentId) ||
      (data.jobRoleId !== undefined && data.jobRoleId !== employee.jobRoleId);

    const overrideDecision = data.overrideDecision;
    const newSupervisorId = data.newSupervisorId;
    const overrideReason = data.overrideReason;

    delete data.overrideDecision;
    delete data.newSupervisorId;
    delete data.overrideReason;

    return await prisma.$transaction(async (tx: any) => {
      let updated = await tx.employee.update({
        where: { id },
        data: {
          ...data,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
          probationDate: toNullableDate(data.probationDate),
          regularizationDate: toNullableDate(data.regularizationDate),
          separationDate: toNullableDate(data.separationDate),
        },
        include: {
          unit: true,
          department: true,
          jobRole: true,
          immediateSupervisor: { select: { id: true, firstName: true, lastName: true, jobRole: { select: { title: true } } } },
          documents: { where: { deletedAt: null }, select: { id: true } },
        },
      });

      if (orgChanged && permissionTier === PermissionTier.FULL) {
        if (updated.jobRoleId) {
          const jr = await tx.jobRole.findUnique({ where: { id: updated.jobRoleId } });
          if (!jr) throw new AppError('Invalid job role', 400);
          // An organisation-wide role (no unit, e.g. Sister) may be held in any unit.
          if (updated.unitId && jr.unitId && jr.unitId !== updated.unitId) throw new AppError('Job role does not belong to the selected unit', 400);
          if (updated.departmentId && jr.departmentId !== updated.departmentId) throw new AppError('Job role does not belong to the selected department', 400);
        }

        if (employee.supervisorAssignmentSource === 'MANUAL_OVERRIDE') {
          if (overrideDecision === 'REVERT_TO_AUTOMATIC') {
            await tx.employee.update({
              where: { id },
              data: {
                supervisorAssignmentSource: null,
                supervisorOverrideReason: null,
                supervisorOverrideAt: null,
              },
            });
            if (requestingUserId) {
              await tx.auditLog.create({
                data: {
                  action: 'SUPERVISOR_OVERRIDE_REMOVED',
                  entityType: 'EMPLOYEE',
                  entityId: employee.id,
                  actorUserId: requestingUserId,
                  metadata: { previousSupervisorId: employee.immediateSupervisorId },
                },
              });
            }
          } else if (overrideDecision === 'SELECT_DIFFERENT_OVERRIDE') {
            if (!newSupervisorId || !overrideReason) {
              throw new AppError('New supervisor ID and reason are required for override', 400);
            }

            const targetSup = await tx.employee.findUnique({ where: { id: newSupervisorId, deletedAt: null } });
            if (!targetSup) throw new AppError('Selected supervisor not found or archived', 404);
            if (targetSup.id === employee.id) throw new AppError('An employee cannot be their own supervisor', 400);
            if (['RESIGNED', 'TERMINATED', 'RETIRED'].includes(targetSup.employmentState)) {
              throw new AppError('Selected supervisor is inactive or separated', 400);
            }

            updated = await tx.employee.update({
              where: { id },
              data: {
                immediateSupervisorId: newSupervisorId,
                supervisorAssignmentStatus: 'ASSIGNED',
                supervisorAssignmentSource: 'MANUAL_OVERRIDE',
                supervisorOverrideReason: overrideReason,
                supervisorOverrideAt: new Date(),
                supervisorPendingReason: null,
              },
              include: {
                unit: true,
                department: true,
                jobRole: true,
                immediateSupervisor: { select: { id: true, firstName: true, lastName: true, jobRole: { select: { title: true } } } },
                documents: { where: { deletedAt: null }, select: { id: true } },
              },
            });

            if (requestingUserId) {
              await tx.auditLog.create({
                data: {
                  action: 'SUPERVISOR_OVERRIDE_APPLIED',
                  entityType: 'EMPLOYEE',
                  entityId: employee.id,
                  actorUserId: requestingUserId,
                  metadata: {
                    previousSupervisorId: employee.immediateSupervisorId,
                    newSupervisorId,
                    reason: overrideReason,
                  },
                },
              });
            }
          }
        }

        const shouldResolve =
          overrideDecision === 'REVERT_TO_AUTOMATIC' ||
          (!employee.supervisorAssignmentSource && !overrideDecision) ||
          (overrideDecision !== 'KEEP_MANUAL_OVERRIDE' && overrideDecision !== 'SELECT_DIFFERENT_OVERRIDE');

        if (shouldResolve) {
          const resolver = new SupervisorResolverService();
          const resolution = await resolver.resolveForEmployee(updated.id, updated.jobRoleId);

          updated = await tx.employee.update({
            where: { id },
            data: {
              immediateSupervisorId: resolution.supervisorId,
              supervisorAssignmentStatus: resolution.assignmentStatus,
              supervisorAssignmentSource: resolution.assignmentSource as any,
              supervisorPendingReason: resolution.pendingReason,
            },
            include: {
              unit: true,
              department: true,
              jobRole: true,
              immediateSupervisor: { select: { id: true, firstName: true, lastName: true, jobRole: { select: { title: true } } } },
              documents: { where: { deletedAt: null }, select: { id: true } },
            },
          });
        }

        if (requestingUserId) {
          await tx.auditLog.create({
            data: {
              action: 'EMPLOYEE_ORGANIZATION_UPDATED',
              entityType: 'EMPLOYEE',
              entityId: id,
              actorUserId: requestingUserId,
              metadata: {
                oldUnit: employee.unitId, newUnit: updated.unitId,
                oldDept: employee.departmentId, newDept: updated.departmentId,
                oldJobRole: employee.jobRoleId, newJobRole: updated.jobRoleId,
                assignmentStatus: updated.supervisorAssignmentStatus,
                assignmentSource: updated.supervisorAssignmentSource,
              },
            },
          });
        }
      }

      if (contactList !== undefined) {
        await writeEmergencyContacts(tx, id, contactList);
      } else if (legacyContactEdit) {
        await tx.employeeEmergencyContact.upsert({
          where: { employeeId_position: { employeeId: id, position: 1 } },
          create: { employeeId: id, position: 1, contactName: updated.emergencyContactName, relationship: updated.emergencyContactRel, mobilePhone: updated.emergencyContactPhone },
          update: { contactName: updated.emergencyContactName, relationship: updated.emergencyContactRel, mobilePhone: updated.emergencyContactPhone },
        });
      }
      if (governmentIdRows !== undefined) {
        await writeGovernmentIds(tx, id, governmentIdRows);
      }

      if (newLoginEmail) {
        const account = await tx.user.findUnique({ where: { employeeId: id }, select: { id: true, email: true } });
        if (account && account.email.toLowerCase() !== newLoginEmail.toLowerCase()) {
          await tx.user.update({ where: { id: account.id }, data: { email: newLoginEmail } });
          await tx.auditLog.create({
            data: {
              action: 'ACCOUNT_LOGIN_EMAIL_CHANGED',
              entityType: 'USER',
              entityId: account.id,
              actorUserId: requestingUserId ?? null,
              targetEmployeeId: id,
              metadata: { from: account.email, to: newLoginEmail, reason: 'Personal email changed (it is the login email).' },
            },
          });
        }
      }

      if (eligibilityChanged) {
        await tx.auditLog.create({
          data: {
            action: 'EMPLOYEE_LEAVE_ELIGIBILITY_UPDATED',
            entityType: 'EMPLOYEE',
            entityId: id,
            actorUserId: requestingUserId ?? null,
            targetEmployeeId: id,
            oldValue: { paternityLeaveEligible: employee.paternityLeaveEligible, soloParentLeaveEligible: employee.soloParentLeaveEligible },
            newValue: { paternityLeaveEligible: updated.paternityLeaveEligible, soloParentLeaveEligible: updated.soloParentLeaveEligible },
          },
        });
      }

      return {
        ...updated,
        profileCompletion: calculateProfileCompletion(updated),
      };
    }).then(async (result) => {
      // A new start date or eligibility changes the completed-years entitlement.
      if (eligibilityChanged || hireDateChanged) {
        await LeaveEntitlementService.syncEmployee(id, { actorUserId: requestingUserId ?? null });
      }
      return result;
    });
  }

  /**
   * Soft-archive employee & log EMPLOYEE_ARCHIVED audit event
   */
  static async archive(id: string, userId: string, reason: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    // Archiving also deactivates the account, so archiving yourself would lock
    // you out mid-session (the same reason you cannot deactivate your own
    // account). Another HR administrator — or Sister — archives this record.
    if (employee.user?.id === userId) {
      throw new AppError('You cannot archive your own record — it would deactivate your own account. Another HR administrator must archive it.', 400);
    }

    const previousAccountStatus = employee.user
      ? (employee.user.isActive ? 'ACTIVE' : 'INACTIVE')
      : 'NO_ACCOUNT';

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.user.updateMany({
      where: { employeeId: id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: 'EMPLOYEE_ARCHIVED',
        entityType: 'EMPLOYEE',
        entityId: id,
        actorUserId: userId,
        metadata: {
          employeeId: id,
          employeeNumber: employee.employeeNumber,
          archiveReason: reason || 'Soft-archived via API',
          previousAccountStatus,
          actorUserId: userId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  static async remove(id: string) {
    await this.archive(id, 'system', 'Soft-archived via remove');
  }

  /**
   * Bulk restore archived employees — FULL tier HR only & log EMPLOYEE_RESTORED
   */
  /**
   * Restores archived employees.
   *
   * `restoreAccountAccess` is honoured: when true, each restored employee's login
   * account is reactivated (and any lock/failed-attempt counter cleared). When
   * false the account is left exactly as it was. The previous implementation
   * accepted the flag from the UI and silently ignored it.
   */
  static async bulkRestore(
    ids: string[],
    requestingUserId: string,
    permissionTier: PermissionTier,
    restoreAccountAccess = false
  ) {
    if (permissionTier !== PermissionTier.FULL) {
      throw new AppError('Only HR can perform bulk restore', 403);
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('No employee IDs provided for restore', 400);
    }
    // One request, one rate-limit count — so the batch itself is capped.
    if (ids.length > MAX_BULK_BATCH) {
      throw new AppError(`At most ${MAX_BULK_BATCH} employees can be restored in one request.`, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const employeesToRestore = await tx.employee.findMany({
        where: { id: { in: ids } },
        include: { user: true },
      });

      const updated = await tx.employee.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: null },
      });

      let accountsReactivated = 0;

      for (const emp of employeesToRestore) {
        const previousAccountStatus = emp.user
          ? emp.user.isActive
            ? 'ACTIVE'
            : 'INACTIVE'
          : 'NO_ACCOUNT';

        if (restoreAccountAccess && emp.user && !emp.user.isActive) {
          await tx.user.update({
            where: { id: emp.user.id },
            data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null },
          });
          accountsReactivated++;

          await tx.auditLog.create({
            data: {
              action: 'ACTIVATE_USER',
              entityType: 'USER',
              entityId: emp.user.id,
              actorUserId: requestingUserId,
              targetEmployeeId: emp.id,
              metadata: { reason: 'Reactivated as part of employee restore' },
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'EMPLOYEE_RESTORED',
            entityType: 'EMPLOYEE',
            entityId: emp.id,
            actorUserId: requestingUserId,
            targetEmployeeId: emp.id,
            metadata: {
              employeeId: emp.id,
              employeeNumber: emp.employeeNumber,
              previousAccountStatus,
              restoreAccountAccess,
              actorUserId: requestingUserId,
              restoredAt: new Date().toISOString(),
              bulkRestore: ids.length > 1,
            },
          },
        });
      }

      return { count: updated.count, accountsReactivated };
    });

    return result;
  }

  /**
   * Eligible supervisors for manual override search
   */
  static async getEligibleSupervisors(excludeEmployeeId?: string) {
    const where: any = {
      deletedAt: null,
      employmentState: 'ACTIVE',
    };
    if (excludeEmployeeId) {
      where.id = { not: excludeEmployeeId };
    }
    return await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        jobRole: { select: { title: true } },
        department: { select: { name: true } },
        unit: { select: { name: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  static async getUnits() {
    return await prisma.unit.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  static async getJobRoles(unitId?: string, departmentId?: string) {
    // Organisation-wide roles (no unit, e.g. Sister) are offered in every unit.
    const and: any[] = [];
    if (unitId) and.push({ OR: [{ unitId }, { unitId: null }] });
    if (departmentId) and.push({ OR: [{ departmentId }, { unitId: null, departmentId: null }] });
    const where: any = and.length ? { AND: and } : {};

    return await prisma.jobRole.findMany({
      where,
      orderBy: { title: 'asc' },
      select: { id: true, code: true, title: true, unitId: true, departmentId: true, permissionTier: true },
    });
  }

  static async getSubordinates(supervisorEmployeeId: string) {
    const list = await prisma.employee.findMany({
      where: {
        immediateSupervisorId: supervisorEmployeeId,
        deletedAt: null,
      },
      include: {
        unit: true,
        jobRole: true,
        department: true,
        user: { select: { id: true, email: true, isActive: true } },
        documents: { where: { deletedAt: null }, select: { id: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return list.map((emp) =>
      EmployeeService.toTeamMemberView({ ...emp, profileCompletion: calculateProfileCompletion(emp) })
    );
  }

  static async resolveSupervisorPreview(data: any) {
    const resolver = new SupervisorResolverService();
    const result = await resolver.resolveForEmployee(data.employeeId || 'preview', data.jobRoleId);
    let supervisor = null;
    if (result.supervisorId) {
      supervisor = await prisma.employee.findUnique({
        where: { id: result.supervisorId },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobRole: { select: { title: true } } },
      });
    }
    const path = await resolver.getOrganizationalPath(data.jobRoleId, data.unitId, data.departmentId);

    return {
      ...result,
      supervisor,
      organizationalPath: path,
    };
  }

  static async applySupervisorOverride(id: string, body: any, user: any) {
    const { supervisorId, reason } = body;
    if (!supervisorId || !reason) {
      throw new AppError('supervisorId and reason are required', 400);
    }
    const employee = await prisma.employee.findUnique({ where: { id, deletedAt: null } });
    if (!employee) throw new AppError('Employee not found', 404);

    if (supervisorId === id) {
      throw new AppError('An employee cannot be their own supervisor', 400);
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        immediateSupervisorId: supervisorId,
        supervisorAssignmentStatus: 'ASSIGNED',
        supervisorAssignmentSource: 'MANUAL_OVERRIDE',
        supervisorOverrideReason: reason,
        supervisorOverrideById: user.userId,
        supervisorOverrideAt: new Date(),
        supervisorPendingReason: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUPERVISOR_OVERRIDE_APPLIED',
        entityType: 'EMPLOYEE',
        entityId: id,
        actorUserId: user.userId,
        metadata: { supervisorId, reason },
      },
    });

    return { success: true, data: updated };
  }

  static async removeSupervisorOverride(id: string, user: any) {
    const employee = await prisma.employee.findUnique({ where: { id, deletedAt: null } });
    if (!employee) throw new AppError('Employee not found', 404);

    const resolver = new SupervisorResolverService();
    const resolution = await resolver.resolveForEmployee(id, employee.jobRoleId);

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        immediateSupervisorId: resolution.supervisorId,
        supervisorAssignmentStatus: resolution.assignmentStatus,
        supervisorAssignmentSource: resolution.assignmentSource as any,
        supervisorPendingReason: resolution.pendingReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SUPERVISOR_OVERRIDE_REMOVED',
        entityType: 'EMPLOYEE',
        entityId: id,
        actorUserId: user.userId,
        metadata: { resolution: resolution as any },
      },
    });

    return { success: true, data: updated };
  }

  /**
   * Excel export generator
   */
  static async exportExcel(requestingEmployeeId: string, permissionTier: PermissionTier, params: any) {
    const listResult = await this.list(requestingEmployeeId, permissionTier, {
      ...params,
      limit: params.scope === 'CURRENT_PAGE' ? (params.limit || 25) : 5000,
      page: params.scope === 'CURRENT_PAGE' ? (params.page || 1) : 1,
    });

    let records = listResult.data;
    if (params.scope === 'SELECTED' && params.selectedIds) {
      const selectedSet = new Set(Array.isArray(params.selectedIds) ? params.selectedIds : String(params.selectedIds).split(','));
      records = records.filter((r) => selectedSet.has(r.id));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HRISense — Hospicio de San Jose';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Employee Directory');
    sheet.columns = [
      { header: 'Employee No', key: 'empNo', width: 15 },
      { header: 'First Name', key: 'firstName', width: 18 },
      { header: 'Middle Name', key: 'middleName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 18 },
      { header: 'Job Role', key: 'jobRole', width: 25 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Unit', key: 'unit', width: 22 },
      { header: 'Immediate Supervisor', key: 'supervisor', width: 25 },
      { header: 'Supervisor Status', key: 'supervisorStatus', width: 18 },
      { header: 'Employment Status', key: 'employmentStatus', width: 18 },
      { header: 'Employment State', key: 'employmentState', width: 18 },
      { header: 'Account Status', key: 'accountStatus', width: 15 },
      { header: 'Date Hired', key: 'hireDate', width: 15 },
      { header: 'Completion (%)', key: 'profileCompletion', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '148281' },
    };

    records.forEach((e: any) => {
      sheet.addRow({
        empNo: e.employeeNumber,
        firstName: e.firstName,
        middleName: e.middleName || '',
        lastName: e.lastName,
        jobRole: e.jobRole?.title || '—',
        department: e.department?.name || '—',
        unit: e.unit?.name || '—',
        supervisor: e.immediateSupervisor ? `${e.immediateSupervisor.firstName} ${e.immediateSupervisor.lastName}` : 'Not Assigned',
        supervisorStatus: e.supervisorAssignmentStatus || '—',
        employmentStatus: e.employmentStatus || '—',
        employmentState: e.employmentState || '—',
        accountStatus: e.user ? (e.user.isActive ? 'Active' : 'Inactive') : 'No Account',
        hireDate: e.hireDate ? new Date(e.hireDate).toISOString().split('T')[0] : '—',
        profileCompletion: `${e.profileCompletion || 0}%`,
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * PDF export generator
   */
  static async exportPDF(requestingEmployeeId: string, permissionTier: PermissionTier, params: any): Promise<Buffer> {
    const listResult = await this.list(requestingEmployeeId, permissionTier, {
      ...params,
      limit: params.scope === 'CURRENT_PAGE' ? (params.limit || 25) : 5000,
      page: params.scope === 'CURRENT_PAGE' ? (params.page || 1) : 1,
    });

    let records = listResult.data;
    if (params.scope === 'SELECTED' && params.selectedIds) {
      const selectedSet = new Set(Array.isArray(params.selectedIds) ? params.selectedIds : String(params.selectedIds).split(','));
      records = records.filter((r) => selectedSet.has(r.id));
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      doc.fontSize(16).fillColor('#148281').text('HOSPICIO DE SAN JOSE', { align: 'center' });
      doc.fontSize(12).fillColor('#333333').text('Employee Directory Report', { align: 'center' });
      doc.fontSize(9).fillColor('#666666').text(`Generated: ${new Date().toLocaleString('en-PH')} | Total Records: ${records.length}`, { align: 'center' });

      // Each row is as tall as its tallest cell, so a long name or unit wraps
      // inside its own column instead of running into the next row.
      const left = 30;
      const columns = [
        { label: 'Emp #', width: 68 },
        { label: 'Full Name', width: 128 },
        { label: 'Job Role', width: 118 },
        { label: 'Dept / Unit', width: 132 },
        { label: 'Supervisor', width: 118 },
        { label: 'State', width: 58 },
        { label: 'Account', width: 56 },
        { label: 'Profile', width: 48 },
        { label: 'Hired', width: 56 },
      ];
      const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
      const padX = 4;
      const padY = 5;
      const bottom = doc.page.height - 40;
      const label = (v: string | null | undefined) =>
        v ? v.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';

      const cellHeight = (cells: string[]) =>
        Math.max(...cells.map((text, i) => doc.heightOfString(text, { width: columns[i].width - padX * 2 }))) + padY * 2;

      // Text first, then the cell borders, so every cell is boxed in by grid lines.
      const drawRow = (cells: string[], y: number, height: number) => {
        let x = left;
        cells.forEach((text, i) => {
          doc.text(text, x + padX, y + padY, { width: columns[i].width - padX * 2 });
          x += columns[i].width;
        });
        x = left;
        doc.lineWidth(0.5).strokeColor('#b9cccc');
        for (const c of columns) {
          doc.rect(x, y, c.width, height).stroke();
          x += c.width;
        }
        return y + height;
      };

      const drawHeader = (y: number) => {
        doc.font('Helvetica-Bold').fontSize(8);
        const labels = columns.map((c) => c.label);
        const height = cellHeight(labels);
        doc.rect(left, y, tableWidth, height).fill('#e6f2f2');
        doc.fillColor('#0f5f5e');
        const next = drawRow(labels, y, height);
        doc.moveTo(left, next).lineTo(left + tableWidth, next).lineWidth(0.8).stroke('#148281');
        doc.font('Helvetica').fontSize(8);
        return next;
      };

      let y = drawHeader(doc.y + 14);

      if (!records.length) {
        doc.fillColor('#666666').text('No employees match the current search and filters.', left + padX, y + padY * 2);
      }

      records.forEach((e: any, index: number) => {
        const cells = [
          e.employeeNumber || '—',
          [e.firstName, e.lastName, e.suffix].filter(Boolean).join(' '),
          e.jobRole?.title || '—',
          [e.department?.name, e.unit?.name].filter(Boolean).join(' / ') || '—',
          e.immediateSupervisor ? `${e.immediateSupervisor.firstName} ${e.immediateSupervisor.lastName}` : 'Not Assigned',
          label(e.employmentState),
          e.user ? (e.user.isActive ? 'Active' : 'Inactive') : 'No account',
          `${e.profileCompletion || 0}%`,
          e.hireDate ? new Date(e.hireDate).toISOString().split('T')[0] : '—',
        ];
        const height = cellHeight(cells);

        if (y + height > bottom) {
          doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
          y = drawHeader(30);
        }

        if (index % 2 === 1) doc.rect(left, y, tableWidth, height).fill('#f6f9f9');
        doc.fillColor('#333333');
        y = drawRow(cells, y, height);
      });

      // Page numbers. Writing below the bottom margin would start a new page,
      // so the margin is lifted while the footer is drawn.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8).fillColor('#888888')
          .text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 25, { width: tableWidth, align: 'right' });
      }

      doc.end();
    });
  }

  /**
   * GET /employees/org-chart — Retrieve organizational tree data
   */
  static async getOrgChartData(
    requestingEmployeeId: string | null,
    requestingRole: string,
    params: {
      unitId?: string;
      departmentId?: string;
      supervisorAssignmentStatus?: string;
      isArchived?: string;
      search?: string;
    }
  ) {
    const { unitId, departmentId, supervisorAssignmentStatus, isArchived, search } = params;

    const where: any = {};

    if (isArchived === 'true') {
      where.deletedAt = { not: null };
    } else if (isArchived === 'all') {
      // return both
    } else {
      where.deletedAt = null;
    }

    if (unitId) where.unitId = unitId;
    if (departmentId) where.departmentId = departmentId;
    if (supervisorAssignmentStatus) where.supervisorAssignmentStatus = supervisorAssignmentStatus;

    if (search) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { employeeNumber: { contains: q } },
        { jobRole: { title: { contains: q } } },
        { unit: { name: { contains: q } } },
        { department: { name: { contains: q } } },
      ];
    }

    // Role-based record scoping for SUPERVISOR and STANDARD.
    // A supervisor's scope is themselves and their DIRECT reports — the same team
    // as everywhere else (OrgHierarchyService.getTeamScopeIds). A coordinator's
    // staff belong to the coordinator's chart, not the head's.
    if (requestingRole === 'SUPERVISOR' && requestingEmployeeId) {
      where.id = { in: await OrgHierarchyService.getTeamScopeIds(requestingEmployeeId) };
    } else if (requestingRole === 'STANDARD' && requestingEmployeeId) {
      const allEmps = await prisma.employee.findMany({
        select: { id: true, immediateSupervisorId: true }
      });
      const empMap = new Map(allEmps.map(e => [e.id, e.immediateSupervisorId]));
      const allowedIds = new Set<string>([requestingEmployeeId]);

      let currentId: string | null | undefined = requestingEmployeeId;
      while (currentId && empMap.has(currentId)) {
        const supId = empMap.get(currentId);
        if (supId && !allowedIds.has(supId)) {
          allowedIds.add(supId);
          currentId = supId;
        } else {
          break;
        }
      }

      for (const e of allEmps) {
        if (e.immediateSupervisorId === requestingEmployeeId) {
          allowedIds.add(e.id);
        }
      }
      where.id = { in: Array.from(allowedIds) };
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        photoUrl: true,
        employmentStatus: true,
        employmentState: true,
        prcLicenseNumber: true,
        professionalRole: true,
        supervisorAssignmentStatus: true,
        supervisorAssignmentSource: true,
        supervisorPendingReason: true,
        immediateSupervisorId: true,
        unitId: true,
        departmentId: true,
        jobRoleId: true,
        deletedAt: true,
        unit: {
          select: { id: true, code: true, name: true }
        },
        department: {
          select: { id: true, code: true, name: true }
        },
        jobRole: {
          select: { id: true, code: true, title: true, permissionTier: true, parentJobRoleId: true }
        },
        user: {
          select: { id: true, email: true, isActive: true }
        },
      },
      orderBy: [
        { unit: { name: 'asc' } },
        { jobRole: { permissionTier: 'asc' } },
        { lastName: 'asc' }
      ]
    });

    const directReportsRaw = await prisma.employee.groupBy({
      by: ['immediateSupervisorId'],
      _count: { id: true },
      where: {
        immediateSupervisorId: { not: null },
        deletedAt: null
      }
    });

    const directReportMap = new Map<string, number>();
    for (const item of directReportsRaw) {
      if (item.immediateSupervisorId) {
        directReportMap.set(item.immediateSupervisorId, item._count.id);
      }
    }

    const nodes = employees.map(emp => ({
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      fullName: `${emp.firstName} ${emp.lastName}`.trim(),
      firstName: emp.firstName,
      lastName: emp.lastName,
      photoUrl: emp.photoUrl,
      unitId: emp.unitId,
      unitName: emp.unit?.name || 'Unassigned Unit',
      unitCode: emp.unit?.code || 'GEN',
      departmentId: emp.departmentId,
      departmentName: emp.department?.name || null,
      departmentCode: emp.department?.code || null,
      jobRoleId: emp.jobRoleId,
      jobRoleTitle: emp.jobRole?.title || 'Unassigned Role',
      jobRoleCode: emp.jobRole?.code || null,
      // Top-level role (HR Officer, Sister): no supervisor is required.
      noSupervisorRequired: NO_SUPERVISOR_REQUIRED_ROLE_CODES.includes(emp.jobRole?.code ?? ''),
      permissionTier: emp.jobRole?.permissionTier || 'STANDARD',
      parentJobRoleId: emp.jobRole?.parentJobRoleId || null,
      immediateSupervisorId: emp.immediateSupervisorId,
      supervisorAssignmentStatus: emp.supervisorAssignmentStatus || 'UNASSIGNED',
      supervisorAssignmentSource: emp.supervisorAssignmentSource || null,
      supervisorPendingReason: emp.supervisorPendingReason || null,
      employmentStatus: emp.employmentStatus,
      employmentState: emp.employmentState,
      // Licence on file = the "Professional" tag on the org-chart card.
      prcLicenseNumber: emp.prcLicenseNumber,
      professionalRole: emp.professionalRole,
      accountStatus: emp.user ? (emp.user.isActive ? 'ACTIVE' : 'INACTIVE') : 'NO_ACCOUNT',
      isArchived: emp.deletedAt !== null,
      directReportCount: directReportMap.get(emp.id) || 0
    }));

    const pendingCount = nodes.filter(n => n.supervisorAssignmentStatus === 'PENDING').length;
    const unassignedCount = nodes.filter(n => n.supervisorAssignmentStatus === 'UNASSIGNED' || !n.immediateSupervisorId).length;

    // Secondary, cross-branch oversight lines (shown only when the chart's
    // "Show Additional Oversight" is on). Display only — no access follows.
    const oversight = await AdditionalOversightService.forOrgChart(
      new Set(nodes.filter(n => !n.isArchived).map(n => n.id)),
      { isFull: requestingRole === 'FULL', employeeId: requestingEmployeeId }
    );

    return {
      nodes,
      pendingCount,
      unassignedCount,
      totalNodes: nodes.length,
      oversight,
    };
  }
}