import { prisma } from '../config/prisma';
import { OnboardingDraftStatus } from '@prisma/client';
import { createAuditLog } from '../lib/audit';

export class DraftService {
  /**
   * Create a new onboarding draft
   */
  static async create(userId: string, data: any, status: OnboardingDraftStatus = 'DRAFT') {
    const draft = await prisma.onboardingDraft.create({
      data: {
        data,
        status,
        createdById: userId,
        lastUpdatedById: userId
      }
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'CREATE_DRAFT',
      entityType: 'DRAFT',
      entityId: draft.id,
      metadata: { status }
    });

    return draft;
  }

  /**
   * Update an existing draft
   */
  static async update(id: string, userId: string, permissionTier: string, updateData: { data?: any, status?: OnboardingDraftStatus, assignedToId?: string }) {
    const existing = await prisma.onboardingDraft.findUnique({ where: { id } });
    if (!existing) throw new Error('Draft not found');

    if (existing.createdById !== userId && permissionTier !== 'FULL') {
      throw new Error('Access denied: You can only edit your own drafts');
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new Error(`Cannot update a ${existing.status.toLowerCase()} draft`);
    }

    const payload: any = {
      lastUpdatedById: userId
    };

    if (updateData.data !== undefined) payload.data = updateData.data;
    if (updateData.status !== undefined) {
      payload.status = updateData.status;
      if (updateData.status === 'COMPLETED') payload.completedAt = new Date();
    }
    if (updateData.assignedToId !== undefined) {
      if (permissionTier !== 'FULL') throw new Error('Only FULL tier can assign drafts');
      payload.assignedToId = updateData.assignedToId;
    }

    const draft = await prisma.onboardingDraft.update({
      where: { id },
      data: payload
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'UPDATE_DRAFT',
      entityType: 'DRAFT',
      entityId: draft.id,
      metadata: { status: draft.status, assignedToId: draft.assignedToId }
    });

    return draft;
  }

  /**
   * Mark draft as completed and link created employee
   */
  static async markCompleted(id: string, userId: string, employeeId: string) {
    const existing = await prisma.onboardingDraft.findUnique({ where: { id } });
    if (!existing) return;

    await prisma.onboardingDraft.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        createdEmployeeId: employeeId,
        completedAt: new Date(),
        lastUpdatedById: userId
      }
    });

    await createAuditLog({
      actorUserId: userId,
      targetEmployeeId: employeeId,
      action: 'COMPLETE_DRAFT',
      entityType: 'DRAFT',
      entityId: id
    });
  }

  /**
   * List drafts based on permissions
   */
  static async list(userId: string, permissionTier: string, status?: OnboardingDraftStatus) {
    if (permissionTier !== 'FULL') {
      // Non-FULL tier shouldn't even be here, but if they are, they only see their own
      return prisma.onboardingDraft.findMany({
        where: {
          createdById: userId,
          ...(status && { status })
        },
        orderBy: { updatedAt: 'desc' }
      });
    }

    // FULL tier sees all drafts, or filtered by status
    return prisma.onboardingDraft.findMany({
      where: {
        ...(status && { status })
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Get draft by ID
   */
  static async getById(id: string, userId: string, permissionTier: string) {
    const draft = await prisma.onboardingDraft.findUnique({ where: { id } });
    if (!draft) throw new Error('Draft not found');

    if (draft.createdById !== userId && permissionTier !== 'FULL') {
      throw new Error('Access denied: You can only view your own drafts');
    }

    return draft;
  }

  /**
   * Delete a draft
   */
  static async delete(id: string, userId: string, permissionTier: string) {
    const existing = await prisma.onboardingDraft.findUnique({ where: { id } });
    if (!existing) throw new Error('Draft not found');

    if (existing.createdById !== userId && permissionTier !== 'FULL') {
      throw new Error('Access denied: You can only delete your own drafts');
    }

    await prisma.onboardingDraft.delete({ where: { id } });

    await createAuditLog({
      actorUserId: userId,
      action: 'DELETE_DRAFT',
      entityType: 'DRAFT',
      entityId: id,
      metadata: { deletedAt: new Date().toISOString() }
    });

    return { id };
  }
}
