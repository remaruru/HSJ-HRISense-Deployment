import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

interface AuditLogOptions {
  userId?: string;
  resource?: string;
  resourceId?: string;
  actorUserId?: string;
  targetEmployeeId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  tx?: Prisma.TransactionClient | any;
}

export const createAuditLog = async (options: AuditLogOptions): Promise<void> => {
  const client = options.tx || prisma;
  try {
    await client.auditLog.create({
      data: {
        actorUserId: options.actorUserId || options.userId || null,
        targetEmployeeId: options.targetEmployeeId || null,
        action: options.action,
        entityType: options.entityType || options.resource || null,
        entityId: options.entityId || options.resourceId || null,
        metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : null,
        oldValue: options.oldValue ? JSON.parse(JSON.stringify(options.oldValue)) : null,
        newValue: options.newValue ? JSON.parse(JSON.stringify(options.newValue)) : null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      },
    });
  } catch (error) {
    console.error('[Audit Log Error]', error);
    if (options.tx) {
      throw error;
    }
  }
};
