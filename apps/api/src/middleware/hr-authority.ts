import { Request, Response, NextFunction } from 'express';
import { PermissionTier } from '@prisma/client';
import { prisma } from '../config/prisma';
import { OrgHierarchyService } from '../services/org-hierarchy.service';
import { AppError } from './errorHandler';

/** Finds the employee(s) a request changes. */
type ResolveTargets = (req: Request) => Promise<Array<string | null | undefined>> | Array<string | null | undefined>;

const ids = (list: Array<string | null | undefined>) =>
  list.filter((id): id is string => typeof id === 'string' && id.length > 0);

/**
 * HR authority over the employee(s) a request changes: Sister may change anyone,
 * other HR only their own record and anyone below HR
 * (`OrgHierarchyService.canManageEmployee`).
 *
 * Callers below HR pass straight through: the route's own rule (`authorize`, or
 * the self-service whitelist) decides for them. Place this BEFORE an upload
 * parser, so a refused request never writes a file to disk.
 */
export const requireHrAuthorityOver = (resolveTargets: ResolveTargets) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user || user.permissionTier !== PermissionTier.FULL) return next();
      await OrgHierarchyService.assertCanManageEmployees(
        { employeeId: user.employeeId, permissionTier: user.permissionTier },
        ids(await resolveTargets(req))
      );
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Refuses an action on the caller's OWN item — approving or declining their own
 * leave, reviewing or deleting their own record, changing their own leave
 * balance or attendance. It applies to everyone, Sister included: nobody signs
 * off on themselves.
 */
export const refuseOwn = (resolveTargets: ResolveTargets, message: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const self = req.user?.employeeId;
      if (self && ids(await resolveTargets(req)).includes(self)) {
        throw new AppError(message, 403, undefined, 'FORBIDDEN');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

/** The employee named in a route parameter (`:id` by default). */
export const targetFromParam = (name = 'id'): ResolveTargets => (req) => [req.params[name]];

/** The employee(s) named in a body field: one id or a list of ids. */
export const targetFromBody = (field: string): ResolveTargets => (req) => {
  const value = req.body?.[field];
  return Array.isArray(value) ? value.map(String) : [value == null ? null : String(value)];
};

/** A route parameter first, then the same-named body field. */
export const targetFromParamOrBody = (name: string): ResolveTargets => (req) =>
  [req.params[name] || (req.body?.[name] == null ? null : String(req.body[name]))];

/** The employee a document belongs to (`:documentId`). */
export const targetOfDocument: ResolveTargets = async (req) => {
  const doc = await prisma.employeeDocument.findUnique({
    where: { id: req.params.documentId },
    select: { employeeId: true },
  });
  return [doc?.employeeId];
};

/** The employee an additional-oversight row is about (`:oversightId`); none for a job-role row. */
export const targetOfOversight: ResolveTargets = async (req) => {
  const row = await prisma.additionalOversight.findUnique({
    where: { id: req.params.oversightId },
    select: { overseenEmployeeId: true },
  });
  return [row?.overseenEmployeeId];
};

/** The employee who filed a leave request (`:id`). */
export const targetOfLeave: ResolveTargets = async (req) => {
  const row = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, select: { employeeId: true } });
  return [row?.employeeId];
};

/** The employee an attendance record belongs to (`:id`). */
export const targetOfAttendance: ResolveTargets = async (req) => {
  const row = await prisma.attendanceRecord.findUnique({ where: { id: req.params.id }, select: { employeeId: true } });
  return [row?.employeeId];
};

/** The employee of one day in an attendance import (`:candidateId`). */
export const targetOfImportCandidate: ResolveTargets = async (req) => {
  const row = await prisma.attendanceImportCandidate.findUnique({
    where: { id: req.params.candidateId },
    select: { employeeId: true },
  });
  return [row?.employeeId];
};

/** The employees of the import days a decision covers (`body.candidateIds`). */
export const targetsOfImportCandidates: ResolveTargets = async (req) => {
  const candidateIds: unknown = req.body?.candidateIds;
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return [];
  const rows = await prisma.attendanceImportCandidate.findMany({
    where: { id: { in: candidateIds.map(String) } },
    select: { employeeId: true },
  });
  return [...new Set(rows.map((r) => r.employeeId))];
};

/** The employee of a medical record (`:recordId`). */
export const targetOfMedicalRecord: ResolveTargets = async (req) => {
  const row = await prisma.medicalRecord.findUnique({ where: { id: req.params.recordId }, select: { employeeId: true } });
  return [row?.employeeId];
};

/** The employee of a medical record's document (`:documentId`). */
export const targetOfMedicalDocument: ResolveTargets = async (req) => {
  const row = await prisma.medicalRecordDocument.findUnique({
    where: { id: req.params.documentId },
    select: { medicalRecord: { select: { employeeId: true } } },
  });
  return [row?.medicalRecord?.employeeId];
};

/** The employee of a psychological record (`:recordId`). */
export const targetOfPsychRecord: ResolveTargets = async (req) => {
  const row = await prisma.psychologicalRecord.findUnique({ where: { id: req.params.recordId }, select: { employeeId: true } });
  return [row?.employeeId];
};

/** The employee of a psychological record's document (`:documentId`). */
export const targetOfPsychDocument: ResolveTargets = async (req) => {
  const row = await prisma.psychologicalRecordDocument.findUnique({
    where: { id: req.params.documentId },
    select: { psychologicalRecord: { select: { employeeId: true } } },
  });
  return [row?.psychologicalRecord?.employeeId];
};

/** The employee of a compliance record (`:recordId`). */
export const targetOfComplianceRecord: ResolveTargets = async (req) => {
  const row = await prisma.employeeComplianceRecord.findUnique({
    where: { id: req.params.recordId },
    select: { employeeId: true },
  });
  return [row?.employeeId];
};

/** The employee being evaluated in an evaluation assignment (`:id`). */
export const targetOfEvaluationAssignment: ResolveTargets = async (req) => {
  const row = await prisma.evaluationAssignment.findUnique({ where: { id: req.params.id }, select: { employeeId: true } });
  return [row?.employeeId];
};

/** The candidate of an award result (`:resultId`). */
export const targetOfAwardResult: ResolveTargets = async (req) => {
  const row = await prisma.awardResult.findUnique({ where: { id: req.params.resultId }, select: { employeeId: true } });
  return [row?.employeeId];
};

// ── Messages ─────────────────────────────────────────────────────────────────

export const OWN_LEAVE_DECISION =
  'Your own leave is accepted automatically when you file it, so you never approve, endorse or decline it yourself.';
export const OWN_LEAVE_BALANCE =
  "You can't change your own leave balance. It follows the automatic yearly entitlement; Sister can adjust it.";
export const OWN_ATTENDANCE =
  "You can't change your own attendance. It stays as recorded; Sister can correct it.";
export const OWN_RECORD_REVIEW =
  'Your own records are accepted automatically once the proof is attached, so you never review them yourself.';
export const OWN_RECORD_DELETE =
  "You can't delete your own records. You can still correct them; Sister can delete one.";
export const OWN_AWARD =
  "You can't decide or record your own award. Another HR person or Sister does it.";
export const OWN_PROOF_DELETE =
  "You can't remove the proof from your own record. Upload a corrected file instead; Sister can remove one.";
