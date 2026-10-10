import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { RequirementCategory, RequirementLifecycle, RequirementScopeType, RecordReviewStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { OrgHierarchyService } from './org-hierarchy.service';

// ─── Compliance Service ────────────────────────────────────────────────────────
// Handles ComplianceRequirement definitions, scopes, and EmployeeComplianceRecord
// fulfillment for CERTIFICATION | PROFESSIONAL_LICENSE | TRAINING | DOCUMENT | OTHER categories.
// Medical/Psychological fulfillment records are handled by their own services.

export class ComplianceService {

  // ── Requirements (HR FULL only) ──────────────────────────────────────────────

  static async listRequirements(filters?: {
    lifecycle?: RequirementLifecycle;
    category?: RequirementCategory;
    search?: string;
  }) {
    const where: any = { deletedAt: null };
    if (filters?.lifecycle) where.lifecycle = filters.lifecycle;
    if (filters?.category) where.category = filters.category;
    if (filters?.search) where.title = { contains: filters.search };

    return prisma.complianceRequirement.findMany({
      where,
      include: {
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getRequirementById(id: string) {
    const req = await prisma.complianceRequirement.findUnique({
      where: { id },
      include: {
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        complianceRecords: { select: { id: true, employeeId: true, reviewStatus: true } },
        medicalRecords:    { select: { id: true, employeeId: true, reviewStatus: true } },
        psychRecords:      { select: { id: true, employeeId: true, reviewStatus: true } },
      },
    });
    if (!req || req.deletedAt) throw new AppError('Compliance requirement not found', 404);
    return req;
  }

  static async createRequirement(data: {
    title: string;
    description?: string;
    category: RequirementCategory;
    tracksExpiry?: boolean;
    reminderDays?: number;
    scopes?: Array<{
      scopeType: RequirementScopeType;
      targetUnitId?: string;
      targetDepartmentId?: string;
      targetJobRoleId?: string;
      targetEmployeeId?: string;
    }>;
    createdById: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const requirement = await prisma.complianceRequirement.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        tracksExpiry: data.tracksExpiry ?? false,
        reminderDays: data.reminderDays,
        lifecycle: 'ACTIVE',
        createdById: data.createdById,
        scopes: data.scopes?.length ? {
          create: data.scopes.map(s => ({
            scopeType: s.scopeType,
            targetUnitId: s.targetUnitId,
            targetDepartmentId: s.targetDepartmentId,
            targetJobRoleId: s.targetJobRoleId,
            targetEmployeeId: s.targetEmployeeId,
          }))
        } : undefined,
      },
      include: {
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId,
      action: 'COMPLIANCE_REQUIREMENT_CREATED',
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: requirement.id,
      metadata: { title: data.title, category: data.category },
      ipAddress,
      userAgent,
    });

    return requirement;
  }

  static async updateRequirement(id: string, data: {
    title?: string;
    description?: string;
    tracksExpiry?: boolean;
    reminderDays?: number;
    lifecycle?: RequirementLifecycle;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const existing = await prisma.complianceRequirement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new AppError('Compliance requirement not found', 404);

    const updated = await prisma.complianceRequirement.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        tracksExpiry: data.tracksExpiry,
        reminderDays: data.reminderDays,
        lifecycle: data.lifecycle,
      },
      include: {
        scopes: {
          include: {
            targetUnit: { select: { id: true, name: true } },
            targetDepartment: { select: { id: true, name: true } },
            targetJobRole: { select: { id: true, title: true } },
            targetEmployee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId,
      action: 'COMPLIANCE_REQUIREMENT_UPDATED',
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: id,
      oldValue: existing,
      newValue: updated,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async archiveRequirement(id: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const existing = await prisma.complianceRequirement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new AppError('Compliance requirement not found', 404);

    const updated = await prisma.complianceRequirement.update({
      where: { id },
      data: { lifecycle: 'INACTIVE', deletedAt: new Date() },
    });

    await createAuditLog({
      actorUserId,
      action: 'COMPLIANCE_REQUIREMENT_ARCHIVED',
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: id,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  // ── Scopes ───────────────────────────────────────────────────────────────────

  static async addScope(requirementId: string, scope: {
    scopeType: RequirementScopeType;
    targetUnitId?: string;
    targetDepartmentId?: string;
    targetJobRoleId?: string;
    targetEmployeeId?: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const req = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
    if (!req || req.deletedAt) throw new AppError('Compliance requirement not found', 404);

    const created = await prisma.complianceRequirementScope.create({
      data: { requirementId, ...scope },
      include: {
        targetUnit: { select: { id: true, name: true } },
        targetDepartment: { select: { id: true, name: true } },
        targetJobRole: { select: { id: true, title: true } },
        targetEmployee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog({
      actorUserId,
      action: 'COMPLIANCE_SCOPE_ADDED',
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: requirementId,
      metadata: scope,
      ipAddress,
      userAgent,
    });

    return created;
  }

  static async deleteScope(scopeId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const scope = await prisma.complianceRequirementScope.findUnique({ where: { id: scopeId } });
    if (!scope) throw new AppError('Scope not found', 404);

    await prisma.complianceRequirementScope.delete({ where: { id: scopeId } });

    await createAuditLog({
      actorUserId,
      action: 'COMPLIANCE_SCOPE_REMOVED',
      entityType: 'COMPLIANCE_REQUIREMENT',
      entityId: scope.requirementId,
      metadata: { scopeId },
      ipAddress,
      userAgent,
    });
  }

  // ── Employee Compliance Records ───────────────────────────────────────────────
  // Only for CERTIFICATION | PROFESSIONAL_LICENSE | TRAINING | DOCUMENT | OTHER categories.

  static async listEmployeeRecords(employeeId: string, currentUser: any) {
    if (currentUser.permissionTier === 'STANDARD' && currentUser.employeeId !== employeeId) {
      throw new AppError('Unauthorized', 403);
    }
    if (currentUser.permissionTier === 'SUPERVISOR' && currentUser.employeeId !== employeeId) {
      // Canonical hierarchy: Employee.immediateSupervisorId (see OrgHierarchyService).
      const isSubordinate = await OrgHierarchyService.isDirectSubordinate(
        currentUser.employeeId,
        employeeId
      );
      if (!isSubordinate) throw new AppError('Unauthorized. Not a direct subordinate.', 403);
    }

    return prisma.employeeComplianceRecord.findMany({
      where: { employeeId, deletedAt: null },
      include: {
        requirement: { select: { id: true, title: true, category: true, tracksExpiry: true, reminderDays: true } },
        documents: {
          where: currentUser.permissionTier !== 'FULL' ? { visibility: 'VISIBLE' } : {},
          select: { id: true, originalFilename: true, visibility: true, uploadedAt: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  static async createEmployeeRecord(data: {
    employeeId: string;
    requirementId: string;
    recordTitle: string;
    referenceNumber?: string;
    completedAt: Date;
    expiresAt?: Date;
    notes?: string;
    createdById: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const req = await prisma.complianceRequirement.findUnique({ where: { id: data.requirementId } });
    if (!req || req.deletedAt) throw new AppError('Compliance requirement not found', 404);

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new AppError('Employee not found', 404);

    const record = await prisma.employeeComplianceRecord.create({
      data: {
        employeeId: data.employeeId,
        requirementId: data.requirementId,
        recordTitle: data.recordTitle,
        referenceNumber: data.referenceNumber,
        completedAt: data.completedAt,
        expiresAt: data.expiresAt,
        notes: data.notes,
        createdById: data.createdById,
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: data.employeeId,
      action: 'COMPLIANCE_RECORD_CREATED',
      entityType: 'EMPLOYEE_COMPLIANCE_RECORD',
      entityId: record.id,
      metadata: { recordTitle: data.recordTitle, requirementId: data.requirementId },
      ipAddress,
      userAgent,
    });

    return record;
  }

  static async reviewRecord(recordId: string, data: {
    reviewStatus: RecordReviewStatus;
    reviewReason?: string;
  }, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.employeeComplianceRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Compliance record not found', 404);

    const updated = await prisma.employeeComplianceRecord.update({
      where: { id: recordId },
      data: {
        reviewStatus: data.reviewStatus,
        reviewedById: actorUserId,
        reviewedAt: new Date(),
        reviewReason: data.reviewReason,
      },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'COMPLIANCE_RECORD_REVIEWED',
      entityType: 'EMPLOYEE_COMPLIANCE_RECORD',
      entityId: recordId,
      metadata: { reviewStatus: data.reviewStatus },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  static async softDeleteRecord(recordId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    const record = await prisma.employeeComplianceRecord.findUnique({ where: { id: recordId } });
    if (!record || record.deletedAt) throw new AppError('Compliance record not found', 404);

    await prisma.employeeComplianceRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      actorUserId,
      targetEmployeeId: record.employeeId,
      action: 'COMPLIANCE_RECORD_DELETED',
      entityType: 'EMPLOYEE_COMPLIANCE_RECORD',
      entityId: recordId,
      ipAddress,
      userAgent,
    });
  }

  // ── Compliance Status Calculations ──────────────────────────────────────────

  /**
   * Returns derived compliance status for a given employee across all applicable requirements.
   */
  static async getEmployeeComplianceSummary(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, unitId: true, departmentId: true, jobRoleId: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);

    const requirements = await prisma.complianceRequirement.findMany({
      where: { lifecycle: 'ACTIVE', deletedAt: null },
      include: {
        scopes: true,
        complianceRecords: { where: { employeeId, deletedAt: null }, orderBy: { completedAt: 'desc' } },
        medicalRecords:    { where: { employeeId, deletedAt: null }, orderBy: { examDate: 'desc' } },
        psychRecords:      { where: { employeeId, deletedAt: null }, orderBy: { assessmentDate: 'desc' } },
      },
    });

    const results = [];
    const now = new Date();

    for (const req of requirements) {
      const applicable = ComplianceService._isApplicable(req.scopes, employee);
      if (!applicable) continue;

      let latestRecord: any = null;
      let latestDate: Date | null = null;
      let expiresAt: Date | null = null;

      if (req.category === 'MEDICAL' && req.medicalRecords.length > 0) {
        latestRecord = req.medicalRecords[0];
        latestDate = latestRecord.examDate;
        expiresAt = latestRecord.expiresAt;
      } else if (req.category === 'PSYCHOLOGICAL' && req.psychRecords.length > 0) {
        latestRecord = req.psychRecords[0];
        latestDate = latestRecord.assessmentDate;
        expiresAt = latestRecord.expiresAt;
      } else if (req.complianceRecords.length > 0) {
        latestRecord = req.complianceRecords[0];
        latestDate = latestRecord.completedAt;
        expiresAt = latestRecord.expiresAt;
      }

      let status = 'MISSING';
      if (latestRecord) {
        if (latestRecord.reviewStatus === 'NEEDS_CORRECTION' || latestRecord.reviewStatus === 'PENDING_REVIEW') {
          status = 'NEEDS_REVIEW';
        } else if (expiresAt && expiresAt < now) {
          status = 'EXPIRED';
        } else if (expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          status = expiresAt <= threshold ? 'EXPIRING_SOON' : 'VALID';
        } else {
          status = 'VALID';
        }
      }

      results.push({
        requirement: {
          id: req.id,
          title: req.title,
          description: req.description,
          category: req.category,
          tracksExpiry: req.tracksExpiry,
          reminderDays: req.reminderDays,
        },
        status,
        latestRecordDate: latestDate,
        expiresAt,
        recordId: latestRecord?.id ?? null,
      });
    }

    return results;
  }

  /**
   * Returns aggregate compliance stats across ALL employees for the HR dashboard.
   * `employeeIds` narrows it to a set (a supervisor's team) using the exact same
   * status rules, so a team count can never disagree with the org count.
   */
  static async getOrgComplianceSummary(employeeIds?: string[]) {
    const employees = await prisma.employee.findMany({
      where: {
        employmentState: 'ACTIVE',
        deletedAt: null,
        ...(employeeIds ? { id: { in: employeeIds } } : {}),
      },
      select: { id: true, unitId: true, departmentId: true, jobRoleId: true, firstName: true, lastName: true, employeeNumber: true },
    });

    const requirements = await prisma.complianceRequirement.findMany({
      where: { lifecycle: 'ACTIVE', deletedAt: null },
      include: {
        scopes: true,
        complianceRecords: { where: { deletedAt: null }, orderBy: { completedAt: 'desc' } },
        medicalRecords:    { where: { deletedAt: null }, orderBy: { examDate: 'desc' } },
        psychRecords:      { where: { deletedAt: null }, orderBy: { assessmentDate: 'desc' } },
      },
    });

    const now = new Date();
    let totalChecks = 0, missing = 0, needsReview = 0, expired = 0, expiringSoon = 0, valid = 0;

    for (const emp of employees) {
      for (const req of requirements) {
        if (!ComplianceService._isApplicable(req.scopes, emp)) continue;
        totalChecks++;

        let latestRecord: any = null;
        let expiresAt: Date | null = null;

        if (req.category === 'MEDICAL') {
          latestRecord = req.medicalRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        } else if (req.category === 'PSYCHOLOGICAL') {
          latestRecord = req.psychRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        } else {
          latestRecord = req.complianceRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        }

        if (!latestRecord) { missing++; continue; }
        if (latestRecord.reviewStatus === 'NEEDS_CORRECTION' || latestRecord.reviewStatus === 'PENDING_REVIEW') {
          needsReview++;
          continue;
        }
        if (expiresAt && expiresAt < now) { expired++; continue; }
        if (expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          if (expiresAt <= threshold) { expiringSoon++; continue; }
        }
        valid++;
      }
    }

    const needsAttentionTotal = missing + needsReview + expired + expiringSoon;

    return {
      totalChecks,
      needsAttentionTotal,
      summary: { missing, needsReview, expired, expiringSoon, valid },
      requirementCount: requirements.length,
      employeeCount: employees.length,
    };
  }

  /**
   * Returns all actionable compliance items across the organization (Needs Attention).
   * Ordered deterministically: EXPIRED > MISSING > EXPIRING_SOON > NEEDS_REVIEW.
   */
  static async getNeedsAttentionItems() {
    const employees = await prisma.employee.findMany({
      where: { employmentState: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        unitId: true,
        departmentId: true,
        jobRoleId: true,
        unit: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobRole: { select: { id: true, title: true } },
      },
    });

    const requirements = await prisma.complianceRequirement.findMany({
      where: { lifecycle: 'ACTIVE', deletedAt: null },
      include: {
        scopes: true,
        complianceRecords: { where: { deletedAt: null }, orderBy: { completedAt: 'desc' } },
        medicalRecords:    { where: { deletedAt: null }, orderBy: { examDate: 'desc' } },
        psychRecords:      { where: { deletedAt: null }, orderBy: { assessmentDate: 'desc' } },
      },
    });

    const now = new Date();
    const attentionItems: any[] = [];

    for (const emp of employees) {
      for (const req of requirements) {
        if (!ComplianceService._isApplicable(req.scopes, emp)) continue;

        let latestRecord: any = null;
        let latestDate: Date | null = null;
        let expiresAt: Date | null = null;

        if (req.category === 'MEDICAL') {
          latestRecord = req.medicalRecords.find(r => r.employeeId === emp.id);
          latestDate = latestRecord?.examDate ?? null;
          expiresAt = latestRecord?.expiresAt ?? null;
        } else if (req.category === 'PSYCHOLOGICAL') {
          latestRecord = req.psychRecords.find(r => r.employeeId === emp.id);
          latestDate = latestRecord?.assessmentDate ?? null;
          expiresAt = latestRecord?.expiresAt ?? null;
        } else {
          latestRecord = req.complianceRecords.find(r => r.employeeId === emp.id);
          latestDate = latestRecord?.completedAt ?? null;
          expiresAt = latestRecord?.expiresAt ?? null;
        }

        let status: 'MISSING' | 'NEEDS_REVIEW' | 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' = 'MISSING';
        if (!latestRecord) {
          status = 'MISSING';
        } else if (latestRecord.reviewStatus === 'NEEDS_CORRECTION' || latestRecord.reviewStatus === 'PENDING_REVIEW') {
          status = 'NEEDS_REVIEW';
        } else if (expiresAt && expiresAt < now) {
          status = 'EXPIRED';
        } else if (expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          if (expiresAt <= threshold) {
            status = 'EXPIRING_SOON';
          } else {
            status = 'VALID';
          }
        } else {
          status = 'VALID';
        }

        if (status !== 'VALID') {
          attentionItems.push({
            employee: {
              id: emp.id,
              employeeNumber: emp.employeeNumber,
              firstName: emp.firstName,
              lastName: emp.lastName,
              jobRole: emp.jobRole?.title || 'Staff',
              unit: emp.unit?.name || 'General',
              department: emp.department?.name,
            },
            requirement: {
              id: req.id,
              title: req.title,
              category: req.category,
              tracksExpiry: req.tracksExpiry,
            },
            status,
            latestRecordDate: latestDate,
            expiresAt,
            recordId: latestRecord?.id ?? null,
          });
        }
      }
    }

    const priorityOrder: Record<string, number> = {
      EXPIRED: 1,
      MISSING: 2,
      EXPIRING_SOON: 3,
      NEEDS_REVIEW: 4,
    };

    attentionItems.sort((a, b) => {
      const pA = priorityOrder[a.status] || 99;
      const pB = priorityOrder[b.status] || 99;
      return pA - pB;
    });

    return attentionItems;
  }

  /**
   * Returns compliance summary for ALL employees for the Employee Compliance Table.
   */
  static async getAllEmployeesComplianceList() {
    const employees = await prisma.employee.findMany({
      where: { employmentState: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        unitId: true,
        departmentId: true,
        jobRoleId: true,
        unit: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobRole: { select: { id: true, title: true } },
      },
      orderBy: { lastName: 'asc' },
    });

    const requirements = await prisma.complianceRequirement.findMany({
      where: { lifecycle: 'ACTIVE', deletedAt: null },
      include: {
        scopes: true,
        complianceRecords: { where: { deletedAt: null }, orderBy: { completedAt: 'desc' } },
        medicalRecords:    { where: { deletedAt: null }, orderBy: { examDate: 'desc' } },
        psychRecords:      { where: { deletedAt: null }, orderBy: { assessmentDate: 'desc' } },
      },
    });

    const now = new Date();

    return employees.map((emp) => {
      let valid = 0;
      let missing = 0;
      let needsReview = 0;
      let expired = 0;
      let expiring = 0;
      let totalApplicable = 0;

      for (const req of requirements) {
        if (!ComplianceService._isApplicable(req.scopes, emp)) continue;
        totalApplicable++;

        let latestRecord: any = null;
        let expiresAt: Date | null = null;

        if (req.category === 'MEDICAL') {
          latestRecord = req.medicalRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        } else if (req.category === 'PSYCHOLOGICAL') {
          latestRecord = req.psychRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        } else {
          latestRecord = req.complianceRecords.find(r => r.employeeId === emp.id);
          expiresAt = latestRecord?.expiresAt ?? null;
        }

        if (!latestRecord) {
          missing++;
        } else if (latestRecord.reviewStatus === 'NEEDS_CORRECTION' || latestRecord.reviewStatus === 'PENDING_REVIEW') {
          needsReview++;
        } else if (expiresAt && expiresAt < now) {
          expired++;
        } else if (expiresAt && req.reminderDays) {
          const threshold = new Date(now.getTime() + req.reminderDays * 24 * 60 * 60 * 1000);
          if (expiresAt <= threshold) {
            expiring++;
          } else {
            valid++;
          }
        } else {
          valid++;
        }
      }

      const needsAttention = missing + needsReview + expired + expiring;

      return {
        employee: {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          unitId: emp.unitId,
          departmentId: emp.departmentId,
          jobRoleId: emp.jobRoleId,
          unit: emp.unit,
          department: emp.department,
          jobRole: emp.jobRole,
        },
        valid,
        needsAttention,
        missing,
        needsReview,
        expired,
        expiring,
        totalApplicable,
      };
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private static _isApplicable(scopes: any[], employee: ComplianceScopeSubject) {
    return complianceRequirementApplies(scopes, employee);
  }
}

/** The employee fields a requirement's scopes are matched against. */
export interface ComplianceScopeSubject {
  id: string;
  unitId: string;
  departmentId: string | null;
  jobRoleId: string;
}

/**
 * Whether a compliance requirement applies to an employee, from its scopes.
 *
 * An EMPLOYEE scope applies only to the employee it names. It previously returned
 * true for every employee as soon as the scope had any target, so a requirement
 * meant for one person was counted as missing for the whole workforce.
 */
export function complianceRequirementApplies(
  scopes: Array<{
    scopeType: string;
    targetUnitId?: string | null;
    targetDepartmentId?: string | null;
    targetJobRoleId?: string | null;
    targetEmployeeId?: string | null;
  }> | null | undefined,
  employee: ComplianceScopeSubject
): boolean {
  if (!scopes || scopes.length === 0) return false;
  for (const scope of scopes) {
    if (scope.scopeType === 'ALL') return true;
    if (scope.scopeType === 'UNIT' && scope.targetUnitId === employee.unitId) return true;
    if (scope.scopeType === 'DEPARTMENT' && scope.targetDepartmentId && scope.targetDepartmentId === employee.departmentId) return true;
    if (scope.scopeType === 'JOB_ROLE' && scope.targetJobRoleId === employee.jobRoleId) return true;
    if (scope.scopeType === 'EMPLOYEE' && scope.targetEmployeeId === employee.id) return true;
  }
  return false;
}
