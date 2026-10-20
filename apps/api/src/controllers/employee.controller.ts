import { Request, Response, NextFunction } from 'express';
import { EmployeeService, OnboardingUploadedFiles } from '../services/employee.service';
import { createAuditLog } from '../lib/audit';
import { cleanupUploadedFiles, flattenMulterFields } from '../middleware/upload';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { OrgHierarchyService } from '../services/org-hierarchy.service';
import { AdditionalOversightService } from '../services/additional-oversight.service';
import { auditSnapshotDiff } from '../services/audit-catalog';
import { ProfileImageService, type ProfileImageKind } from '../services/profile-image.service';
import { EmployeeProfileExportService } from '../services/employee-profile-export.service';

export class EmployeeController {
  /**
   * GET /employees/:id/export/pdf — the profile as a PDF. HR may export anyone;
   * every other user only their own record. Each export is written to the audit log.
   */
  static async exportProfilePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.params.id;
      if (req.user!.permissionTier !== 'FULL' && req.user!.employeeId !== employeeId) {
        throw new AppError('You can export only your own profile.', 403);
      }
      const { buffer, fileName } = await EmployeeProfileExportService.toPdf(employeeId);
      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employeeId,
        action: 'EMPLOYEE_PROFILE_EXPORTED',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees — list employees (HR: all, supervisor: direct reports, standard: own)
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page, limit, search, unitId, status,
        departmentId, jobRoleId, immediateSupervisorId,
        employmentState, accountStatus, supervisorAssignmentStatus,
        supervisorAssignmentSource, hireDateFrom, hireDateTo, isArchived,
        sortBy, sortOrder
      } = req.query;
      const result = await EmployeeService.list(
        req.user!.employeeId!,
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 25,
          search: search as string,
          unitId: unitId as string,
          status: status as string,
          departmentId: departmentId as string,
          jobRoleId: jobRoleId as string,
          immediateSupervisorId: immediateSupervisorId as string,
          employmentState: employmentState as string,
          accountStatus: accountStatus as string,
          supervisorAssignmentStatus: supervisorAssignmentStatus as string,
          supervisorAssignmentSource: supervisorAssignmentSource as string,
          hireDateFrom: hireDateFrom as string,
          hireDateTo: hireDateTo as string,
          isArchived: isArchived as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /** GET /employees/additional-oversight — every additional oversight relationship (HR). */
  static async listAdditionalOversight(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AdditionalOversightService.list() });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/additional-oversight — { overseerId, overseenEmployeeId | overseenJobRoleId } (HR). */
  static async addAdditionalOversight(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      await AdditionalOversightService.add(req.body ?? {}, { id: req.user.userId, employeeId: req.user.employeeId });
      res.status(201).json({ success: true, data: await AdditionalOversightService.list(), message: 'Additional oversight added' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /employees/:id/additional-oversight — one employee's additional overseers and direct reports (HR). */
  static async employeeAdditionalOversight(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await AdditionalOversightService.forEmployee(req.params.id) });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/additional-oversight — { overseerId, includeReportIds? } (HR). */
  static async addEmployeeAdditionalOversight(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const result = await AdditionalOversightService.addForEmployee(
        { overseerId: req.body?.overseerId, overseenEmployeeId: req.params.id, includeReportIds: req.body?.includeReportIds },
        { id: req.user.userId, employeeId: req.user.employeeId }
      );
      res.status(201).json({ success: true, data: { ...result, summary: await AdditionalOversightService.forEmployee(req.params.id) }, message: 'Additional overseer added' });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /employees/additional-oversight/:oversightId (HR). */
  static async removeAdditionalOversight(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      await AdditionalOversightService.remove(req.params.oversightId, { id: req.user.userId, employeeId: req.user.employeeId });
      res.json({ success: true, data: await AdditionalOversightService.list(), message: 'Additional oversight removed' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/org-chart — get org chart nodes
   */
  static async getOrgChart(req: Request, res: Response, next: NextFunction) {
    try {
      const { unitId, departmentId, supervisorAssignmentStatus, isArchived, search } = req.query;
      const result = await EmployeeService.getOrgChartData(
        req.user?.employeeId || null,
        req.user?.permissionTier || 'STANDARD',
        {
          unitId: unitId as string,
          departmentId: departmentId as string,
          supervisorAssignmentStatus: supervisorAssignmentStatus as string,
          isArchived: isArchived as string,
          search: search as string,
        }
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/:id — get employee by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      // Object-level authorization. Previously this route had NO check at all, so
      // any authenticated user could read any employee's government IDs, address,
      // date of birth and emergency contacts.
      const actor = { employeeId: req.user!.employeeId, permissionTier: req.user!.permissionTier };
      const allowed = await OrgHierarchyService.canAccessEmployeeRecord(actor, req.params.id);
      if (!allowed) {
        throw new AppError('You do not have permission to view this employee record.', 403);
      }

      const employee = await EmployeeService.getById(req.params.id);
      // HR and the employee get the whole record; a supervisor opening a direct
      // report gets the work profile (My Team), not the personal record.
      res.json({
        success: true,
        data: OrgHierarchyService.canViewFullEmployeeRecord(actor, req.params.id)
          ? employee
          : EmployeeService.toTeamMemberView(employee),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/:id/timeline — audit history for one employee.
   *
   * HR and the employee themselves only: it is the record's audit trail (who
   * changed the personal record, account events), and supervisors hold no audit
   * permission. Returns only safe fields: never password hashes, tokens, or
   * confidential medical/psychological detail.
   */
  static async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const allowed = OrgHierarchyService.canViewFullEmployeeRecord(
        { employeeId: req.user!.employeeId, permissionTier: req.user!.permissionTier },
        req.params.id
      );
      if (!allowed) {
        throw new AppError('You do not have permission to view this employee timeline.', 403);
      }

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const events = await EmployeeService.getTimeline(req.params.id, limit);
      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/:id/profile-completion — how the percentage was reached.
   * Same object-level rule as the profile itself.
   */
  static async getProfileCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const allowed = await OrgHierarchyService.canAccessEmployeeRecord(
        { employeeId: req.user!.employeeId, permissionTier: req.user!.permissionTier },
        req.params.id
      );
      if (!allowed) {
        throw new AppError('You do not have permission to view this employee record.', 403);
      }
      const data = await EmployeeService.getProfileCompletionBreakdown(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/me — shortcut for own profile
   */
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await EmployeeService.getById(req.user!.employeeId!);
      res.json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees/me/photo and /employees/me/banner — the person's own profile
   * photo or banner (multipart field `file`). Returns the new preview path.
   */
  static setMyProfileImage(kind: ProfileImageKind) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const employeeId = req.user?.employeeId;
        if (!employeeId) throw new AppError('Your account has no employee record.', 400);
        const url = await ProfileImageService.set(kind, employeeId, req.user!.userId, req.file, req.ip, req.headers['user-agent']);
        res.json({ success: true, data: kind === 'photo' ? { photoUrl: url } : { bannerUrl: url } });
      } catch (err) {
        next(err);
      }
    };
  }

  /** DELETE /employees/me/banner — back to the default banner. */
  static async removeMyBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.user?.employeeId;
      if (!employeeId) throw new AppError('Your account has no employee record.', 400);
      await ProfileImageService.removeBanner(employeeId, req.user!.userId, req.ip, req.headers['user-agent']);
      res.json({ success: true, data: { bannerUrl: null } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees — create new employee (HR only)
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    const uploaded = (req.files ?? {}) as OnboardingUploadedFiles;
    const allFiles = flattenMulterFields(req.files as any);

    let result: Awaited<ReturnType<typeof EmployeeService.create>>;
    try {
      result = await EmployeeService.create(req.body, req.user!.userId, uploaded);
    } catch (err) {
      // The transaction rolled back — do not leave uploaded files orphaned on disk.
      cleanupUploadedFiles(allFiles);
      return next(err);
    }

    const { employee, temporaryPassword, accountCreated, accountEmail, documentsSaved } = result;
    const warnings: string[] = [...result.warnings];

    // ── Post-creation side effects. None of these may roll back the employee. ──

    // 1. Initial work schedule assignment (legacy template track).
    if (req.body.scheduleTemplateId) {
      try {
        const { ScheduleService } = await import('../services/schedule.service');
        const hireDate = new Date(employee.hireDate).toISOString().split('T')[0];
        await ScheduleService.assignSchedule(
          [employee.id],
          req.body.scheduleTemplateId,
          hireDate,
          req.user!.userId
        );
      } catch (scheduleErr: any) {
        console.warn('[Onboarding] Failed to assign initial schedule:', scheduleErr);
        warnings.push(
          scheduleErr?.message ||
            'The initial work schedule could not be assigned. Assign it from Work Schedule.'
        );
      }
    }

    // 2. Close the onboarding draft — only now that the employee genuinely exists.
    let linkedJobApplicationId: string | null = null;
    if (req.body.draftId) {
      try {
        const { DraftService } = await import('../services/draft.service');
        await DraftService.markCompleted(req.body.draftId, req.user!.userId, employee.id);
      } catch (draftErr: any) {
        console.warn('[Onboarding] Failed to mark onboarding draft as completed:', draftErr);
        warnings.push('The onboarding draft could not be marked complete. Close it manually.');
      }

      // 3. Complete the recruitment chain: applicant → draft → employee.
      try {
        const application = await prisma.jobApplication.findFirst({
          where: { onboardingDraftId: req.body.draftId },
          select: { id: true, employeeId: true, referenceNumber: true },
        });
        if (application && !application.employeeId) {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { employeeId: employee.id },
          });
          linkedJobApplicationId = application.id;
          await createAuditLog({
            actorUserId: req.user!.userId,
            targetEmployeeId: employee.id,
            action: 'APPLICATION_LINKED_TO_EMPLOYEE',
            entityType: 'JobApplication',
            entityId: application.id,
            metadata: {
              referenceNumber: application.referenceNumber,
              employeeNumber: employee.employeeNumber,
            },
          });
        }
      } catch (linkErr) {
        console.warn('[Onboarding] Failed to link job application to employee:', linkErr);
        warnings.push('The linked job application could not be updated with the new employee record.');
      }
    }

    // 4. Welcome email with the temporary credentials — never fatal.
    //
    // DELIVERY ADDRESS: the employee's own PERSONAL email is the authoritative
    // recipient for first-login credentials. A work address is often created by
    // the hospital only after the employee starts, so it may not be reachable on
    // day one. The login ID stays whatever the account was created against; only
    // the delivery address differs. If no personal email was recorded, the
    // credentials go to the account address — which still belongs to this same
    // employee. HRISense never falls back to an HR mailbox or anyone else.
    const personalEmail =
      typeof employee.personalEmail === 'string' && employee.personalEmail.trim()
        ? employee.personalEmail.trim()
        : null;
    const credentialEmail = personalEmail || accountEmail;

    let emailSent = false;
    let emailMessage: string | null = null;
    if (accountCreated && credentialEmail && temporaryPassword) {
      try {
        const { EmployeeEmailService } = await import('../services/email/employee-email.service');
        const outcome = await EmployeeEmailService.sendWelcomeEmail({
          toEmail: credentialEmail,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          employeeNumber: employee.employeeNumber,
          loginId: accountEmail ?? credentialEmail,
          temporaryPassword,
        });
        emailSent = outcome.sent;
        emailMessage = outcome.message;
      } catch (emailErr) {
        console.error('[Onboarding] Welcome email failed:', emailErr);
        emailSent = false;
        emailMessage = `The welcome email could not be delivered to ${credentialEmail}. Give the temporary password to the employee directly.`;
      }
      if (!emailSent && emailMessage) warnings.push(emailMessage);
      if (!personalEmail) {
        warnings.push(
          'No personal email was recorded for this employee, so the credentials were addressed to the account email instead.'
        );
      }
    }

    await createAuditLog({
      userId: req.user!.userId,
      targetEmployeeId: employee.id,
      action: 'CREATE_EMPLOYEE',
      resource: 'Employee',
      resourceId: employee.id,
      newValue: {
        employeeNumber: employee.employeeNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        accountCreated,
        documentsSaved,
        welcomeEmailSent: emailSent,
        welcomeEmailRecipient: credentialEmail,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: {
        ...employee,
        // Returned exactly once, to the authorised HR caller. Never persisted in plaintext.
        temporaryPassword,
        accountCreated,
        accountEmail,
        documentsSaved,
        emailSent,
        emailMessage,
        /** Where the credentials were actually addressed (personal email first). */
        emailRecipient: credentialEmail,
        linkedJobApplicationId,
      },
      warnings,
    });
  }

  /**
   * PUT /employees/:id — update employee
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      // Before / after snapshots, so the audit row records what actually
      // changed rather than the whole submitted form.
      const snapshot = () =>
        prisma.employee.findUnique({
          where: { id: req.params.id },
          include: {
            emergencyContacts: { select: { position: true, contactName: true, relationship: true, mobilePhone: true }, orderBy: { position: 'asc' } },
            governmentIds: { select: { position: true, idType: true, idNumber: true }, orderBy: { position: 'asc' } },
          },
        });
      const before = await snapshot();

      const employee = await EmployeeService.update(
        req.params.id,
        req.body,
        req.user!.employeeId!,
        req.user!.permissionTier,
        req.user!.userId
      );

      const after = await snapshot();
      const diff = auditSnapshotDiff(before, after);
      // Related rows: named as changed, values not copied into the audit trail.
      if (JSON.stringify(before?.emergencyContacts) !== JSON.stringify(after?.emergencyContacts)) diff.fields.push('emergencyContacts');
      if (JSON.stringify(before?.governmentIds) !== JSON.stringify(after?.governmentIds)) diff.fields.push('otherGovernmentIdRows');

      await createAuditLog({
        userId: req.user!.userId,
        action: 'UPDATE_EMPLOYEE',
        resource: 'Employee',
        resourceId: req.params.id,
        targetEmployeeId: req.params.id,
        oldValue: diff.oldValue,
        newValue: diff.newValue,
        metadata: { fields: diff.fields },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /employees/:id — soft-delete (HR only)
   */
  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const reason = (req.body && req.body.reason) || (req.query && req.query.reason) || 'Soft-archived via API';
      await EmployeeService.archive(req.params.id, req.user!.userId, reason as string);
      res.json({ success: true, message: 'Employee archived successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees/bulk-restore — restore archived employees (HR only)
   */
  static async bulkRestore(req: Request, res: Response, next: NextFunction) {
    try {
      const ids = req.body?.ids || (req.params?.id ? [req.params.id] : []);
      const restoreAccountAccess = req.body?.restoreAccountAccess === true;
      const result = await EmployeeService.bulkRestore(
        ids,
        req.user!.userId,
        req.user!.permissionTier,
        restoreAccountAccess
      );

      const accountNote = restoreAccountAccess
        ? ` ${result.accountsReactivated} login account(s) reactivated.`
        : '';

      res.json({
        success: true,
        ...result,
        message: `${result.count} employee(s) restored successfully.${accountNote}`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/eligible-supervisors — eligible supervisor search
   */
  static async getEligibleSupervisors(req: Request, res: Response, next: NextFunction) {
    try {
      const supervisors = await EmployeeService.getEligibleSupervisors(req.query.excludeId as string);
      res.json({ success: true, data: supervisors });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET/POST /employees/export/excel
   */
  static async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const params = { ...req.query, ...req.body };
      const buffer = await EmployeeService.exportExcel(req.user!.employeeId!, req.user!.permissionTier, params);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Employee_Directory_${Date.now()}.xlsx"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET/POST /employees/export/pdf
   */
  static async exportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const params = { ...req.query, ...req.body };
      const buffer = await EmployeeService.exportPDF(req.user!.employeeId!, req.user!.permissionTier, params);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Employee_Directory_${Date.now()}.pdf"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/units — list all units
   */
  static async getUnits(_req: Request, res: Response, next: NextFunction) {
    try {
      const units = await EmployeeService.getUnits();
      res.json({ success: true, data: units });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/job-roles — list all job roles
   */
  static async getJobRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const { unitId, departmentId } = req.query;
      const jobRoles = await EmployeeService.getJobRoles(unitId as string, departmentId as string);
      res.json({ success: true, data: jobRoles });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /employees/subordinates — supervisor's team list
   */
  static async getSubordinates(req: Request, res: Response, next: NextFunction) {
    try {
      const subordinates = await EmployeeService.getSubordinates(req.user!.employeeId!);
      res.json({ success: true, data: subordinates });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees/resolve-supervisor
   */
  static async resolveSupervisor(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmployeeService.resolveSupervisorPreview(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /employees/:id/supervisor-override
   */
  static async overrideSupervisor(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await EmployeeService.applySupervisorOverride(id, req.body, req.user);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /employees/:id/supervisor-override
   */
  static async removeSupervisorOverride(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await EmployeeService.removeSupervisorOverride(id, req.user);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}