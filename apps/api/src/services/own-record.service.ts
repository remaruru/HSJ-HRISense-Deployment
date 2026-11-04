import { prisma } from '../config/prisma';
import { NotificationType, PermissionTier, RecordReviewStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';
import { NotificationService } from './notification.service';

/**
 * HR's OWN medical, psychological and compliance records (the user's rule,
 * 2026-11-04).
 *
 * Another HR person may not touch them and Sister only oversees, so nobody is
 * left to review them. They are accepted automatically — but only with proof:
 * a file on a medical or psychological record, a reference number on a
 * compliance record (that module has no file upload) — and Sister is told.
 * HR may not review, delete or strip the proof from their own records (routes,
 * `refuseOwn`).
 */

type Kind = 'medical' | 'psychological' | 'compliance';

type Actor = { userId?: string; employeeId?: string; permissionTier?: PermissionTier | string };

const WORDS: Record<Kind, string> = {
  medical: 'medical record',
  psychological: 'psychological record',
  compliance: 'compliance record',
};
const LINK: Record<Kind, string> = { medical: '/medical', psychological: '/psychological', compliance: '/compliance' };
const AUDIT: Record<Kind, { action: string; entityType: string }> = {
  medical: { action: 'MEDICAL_RECORD_AUTO_ACCEPTED', entityType: 'MEDICAL_RECORD' },
  psychological: { action: 'PSYCH_RECORD_AUTO_ACCEPTED', entityType: 'PSYCHOLOGICAL_RECORD' },
  compliance: { action: 'COMPLIANCE_RECORD_AUTO_ACCEPTED', entityType: 'EMPLOYEE_COMPLIANCE_RECORD' },
};

export const AUTO_ACCEPT_REASON = "Accepted automatically: HR's own record, with proof attached.";

export class OwnRecordService {
  /** True when HR (FULL tier, Sister included) acts on their own record. */
  static isOwn(actor: Actor | undefined, employeeId: string | null | undefined): boolean {
    return actor?.permissionTier === PermissionTier.FULL && !!actor.employeeId && actor.employeeId === employeeId;
  }

  private static async find(kind: Kind, recordId: string) {
    const select = { id: true, employeeId: true, reviewStatus: true, deletedAt: true } as const;
    if (kind === 'medical') return prisma.medicalRecord.findUnique({ where: { id: recordId }, select });
    if (kind === 'psychological') return prisma.psychologicalRecord.findUnique({ where: { id: recordId }, select });
    return prisma.employeeComplianceRecord.findUnique({ where: { id: recordId }, select });
  }

  private static async markAccepted(kind: Kind, recordId: string, reviewerUserId: string | null) {
    const data = {
      reviewStatus: RecordReviewStatus.ACCEPTED,
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
      reviewReason: AUTO_ACCEPT_REASON,
    };
    if (kind === 'medical') return prisma.medicalRecord.update({ where: { id: recordId }, data });
    if (kind === 'psychological') return prisma.psychologicalRecord.update({ where: { id: recordId }, data });
    return prisma.employeeComplianceRecord.update({ where: { id: recordId }, data });
  }

  private static async nameOf(employeeId: string): Promise<string> {
    const e = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true, lastName: true, jobRole: { select: { title: true } } },
    });
    if (!e) return 'An HR person';
    return `${e.firstName} ${e.lastName}`.trim() + (e.jobRole?.title ? ` (${e.jobRole.title})` : '');
  }

  /**
   * Accepts HR's own record now that it carries proof. Does nothing for anyone
   * else's record, or one already accepted. Returns true when it accepted.
   */
  static async acceptWithProof(kind: Kind, recordId: string, actor: Actor, proof: string): Promise<boolean> {
    const record = await OwnRecordService.find(kind, recordId);
    if (!record || record.deletedAt || !OwnRecordService.isOwn(actor, record.employeeId)) return false;
    if (record.reviewStatus === RecordReviewStatus.ACCEPTED) return false;

    await OwnRecordService.markAccepted(kind, recordId, actor.userId ?? null);
    await createAuditLog({
      actorUserId: actor.userId,
      targetEmployeeId: record.employeeId,
      action: AUDIT[kind].action,
      entityType: AUDIT[kind].entityType,
      entityId: recordId,
      metadata: { detail: `${AUTO_ACCEPT_REASON} Proof: ${proof}` },
    });
    await NotificationService.notifySister({
      type: NotificationType.COMPLIANCE_ALERT,
      eventId: `own-record-accepted-sister:${kind}:${recordId}`,
      title: 'HR record accepted automatically',
      message: `${await OwnRecordService.nameOf(record.employeeId)} added their own ${WORDS[kind]} with proof attached (${proof}). HR's own records are accepted automatically; this is for your information only.`,
      link: LINK[kind],
    }, actor.userId);
    return true;
  }

  /** Tells Sister that HR changed their own record (e.g. moved an expiry date). */
  static async noteOwnChange(kind: Kind, recordId: string, actor: Actor): Promise<void> {
    const record = await OwnRecordService.find(kind, recordId);
    if (!record || !OwnRecordService.isOwn(actor, record.employeeId)) return;
    await NotificationService.notifySister({
      type: NotificationType.COMPLIANCE_ALERT,
      // One notice per change: the timestamp keeps later edits from being dropped as duplicates.
      eventId: `own-record-changed-sister:${kind}:${recordId}:${Date.now()}`,
      title: 'HR changed their own record',
      message: `${await OwnRecordService.nameOf(record.employeeId)} changed their own ${WORDS[kind]}. This is for your information only.`,
      link: LINK[kind],
    }, actor.userId);
  }
}
