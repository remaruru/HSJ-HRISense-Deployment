import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { verifyAccessToken } from '../lib/jwt';
import { PermissionTier } from '@prisma/client';
import { prisma } from '../config/prisma';
import { limitAuthenticatedTraffic } from './rate-limit';

/**
 * What an account with a temporary password (`mustChangePassword`) may still
 * call: change the password, read who it is, and sign out. Everything else is
 * refused by the API itself — not only hidden by the web app's routing.
 */
const ALLOWED_WHILE_PASSWORD_CHANGE_REQUIRED = new Set([
  'POST /api/v1/auth/change-password',
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/logout',
]);

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Please sign in to continue.', 401, undefined, 'UNAUTHENTICATED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Please sign in to continue.', 401, undefined, 'UNAUTHENTICATED');
    }

    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      roleCode: decoded.roleCode,
      permissionTier: decoded.permissionTier as PermissionTier,
      employeeId: decoded.employeeId,
    };

    // The account's current state, read on every request: a deactivated
    // account or a temporary password takes effect immediately, not when the
    // access token happens to expire.
    const account = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isActive: true, deletedAt: true, mustChangePassword: true },
    });
    if (!account || account.deletedAt || !account.isActive) {
      throw new AppError('Your account is no longer active. Contact HR.', 401, undefined, 'ACCOUNT_INACTIVE');
    }
    if (account.mustChangePassword) {
      const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
      if (!ALLOWED_WHILE_PASSWORD_CHANGE_REQUIRED.has(route)) {
        throw new AppError(
          'Change your temporary password before using HRISense.',
          403,
          undefined,
          'PASSWORD_CHANGE_REQUIRED'
        );
      }
    }

    limitAuthenticatedTraffic(req, res, next);
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new AppError('Your session has expired. Please sign in again.', 401, undefined, 'TOKEN_EXPIRED'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new AppError('Your session is no longer valid. Please sign in again.', 401, undefined, 'TOKEN_INVALID'));
    } else {
      next(error);
    }
  }
};
