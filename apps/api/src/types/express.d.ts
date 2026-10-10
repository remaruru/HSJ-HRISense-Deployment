import { PermissionTier } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Short error reference, set by middleware/request-id.ts. */
      id?: string;
      user?: {
        userId: string;
        email: string;
        roleCode: string;
        permissionTier: PermissionTier;
        employeeId?: string;
      };
    }
  }
}
