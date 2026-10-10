import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  comparePassword,
  hashPassword,
  validatePasswordComplexity,
  PASSWORD_POLICY,
} from '../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { createAuditLog } from '../lib/audit';

/** How long a self-service password reset link stays valid. */
const RESET_TOKEN_TTL_MINUTES = 60;

type SignInUser = Prisma.UserGetPayload<{ include: { employee: { include: { jobRole: true } } } }>;

/** Shown when a verified Google email belongs to no HRISense account (or an archived one). */
export const GOOGLE_NO_ACCOUNT_MESSAGE =
  'No HRISense account is registered with this Google email. HRISense is only for Hospicio de San Jose employees — if you are not one, please do not sign in: repeated sign-ins with unregistered emails from this network will be blocked. Employees: please contact HR.';

export class AuthService {
  /**
   * Log in user, handle login limits and session creation
   */
  static async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: {
          include: {
            jobRole: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`, 403);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Contact HR.', 403);
    }

    // Verify password
    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const isLockout = newAttempts >= 5;
      const lockedUntil = isLockout ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 mins lock

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: isLockout ? 0 : newAttempts,
          lockedUntil,
        },
      });

      await createAuditLog({
        actorUserId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress,
        userAgent,
        newValue: { failedAttempts: newAttempts, locked: isLockout },
      });

      if (isLockout) {
        throw new AppError('Too many failed login attempts. Your account is locked for 15 minutes.', 403);
      }

      throw new AppError('Invalid email or password', 401);
    }

    return this.startSession(user, ipAddress, userAgent, { action: 'LOGIN_SUCCESS' });
  }

  /**
   * Google Sign-In, after the Google credential has been verified on the server
   * (see google-auth.service.ts). Google only proves who the person is: the
   * account must already exist, and every HRISense rule still applies — archived,
   * locked and deactivated accounts are refused, the permission tier comes from
   * the database, and a temporary password still has to be changed first
   * (`mustChangePassword` travels in the response and is enforced by the API).
   */
  static async loginWithVerifiedEmail(email: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { employee: { include: { jobRole: true } } },
    });

    // Same answer for no account and an archived one: nothing more is revealed.
    // Both count towards the per-IP block on unregistered Google sign-ins.
    if (!user || user.deletedAt) {
      await createAuditLog({
        actorUserId: user?.id,
        action: user ? 'GOOGLE_LOGIN_FAILED' : 'GOOGLE_LOGIN_UNREGISTERED',
        entityType: 'USER',
        entityId: user?.id,
        ipAddress,
        userAgent,
        // The attempted address is kept for HR's security review; nothing from Google's token is.
        metadata: user ? { method: 'GOOGLE', reason: 'ACCOUNT_ARCHIVED' } : { method: 'GOOGLE', email: email.trim().toLowerCase() },
      });
      throw new AppError(GOOGLE_NO_ACCOUNT_MESSAGE, 403, undefined, 'GOOGLE_NO_ACCOUNT');
    }

    const refuse = async (reason: string, message: string) => {
      await createAuditLog({
        actorUserId: user.id,
        action: 'GOOGLE_LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { method: 'GOOGLE', reason },
      });
      throw new AppError(message, 403);
    };

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await refuse('ACCOUNT_LOCKED', `Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`);
    }
    if (!user.isActive) {
      await refuse('ACCOUNT_DEACTIVATED', 'Your account has been deactivated, so access is unavailable. Contact HR.');
    }

    return this.startSession(user, ipAddress, userAgent, { action: 'GOOGLE_LOGIN_SUCCESS', metadata: { method: 'GOOGLE' } });
  }

  /**
   * Issues a normal HRISense session (access token + stored refresh token) for
   * an account that has already passed its sign-in checks. Shared by password
   * and Google sign-in so both produce exactly the same session.
   */
  private static async startSession(
    user: SignInUser,
    ipAddress: string | undefined,
    userAgent: string | undefined,
    audit: { action: string; metadata?: Record<string, unknown> }
  ) {
    // Sign-in successful — reset failed attempts, update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    const employee = user.employee;
    if (!employee) {
      throw new AppError('User profile configuration is incomplete', 400);
    }

    const payload = {
      userId: user.id,
      email: user.email,
      roleCode: employee.jobRole.code,
      permissionTier: employee.jobRole.permissionTier,
      employeeId: employee.id,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ userId: user.id });

    // Store the refresh token session in database
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceInfo: userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: audit.action,
      entityType: 'USER',
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: audit.metadata,
    });

    const permissionsRelations = await prisma.rolePermission.findMany({
      where: { jobRoleId: employee.jobRoleId },
      include: { permission: true },
    });
    const permissions = permissionsRelations.map(
      (rp) => `${rp.permission.module}.${rp.permission.action}.${rp.permission.scope}`
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        permissionTier: employee.jobRole.permissionTier,
        permissions,
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          photoUrl: employee.photoUrl,
          jobRole: {
            title: employee.jobRole.title,
            code: employee.jobRole.code,
            permissionTier: employee.jobRole.permissionTier,
          },
        },
      },
    };
  }

  /**
   * Refresh the access and refresh tokens (rotates both)
   */
  static async refresh(token: string, ipAddress?: string, userAgent?: string) {
    try {
      const decoded = verifyRefreshToken(token);
      
      const session = await prisma.userSession.findUnique({
        where: { refreshToken: token },
        include: {
          user: {
            include: {
              employee: {
                include: {
                  jobRole: true,
                },
              },
            },
          },
        },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        if (session) {
          // Revoke all sessions for this user as a security measure on token reuse
          await prisma.userSession.updateMany({
            where: { userId: session.userId },
            data: { isRevoked: true },
          });
        }
        throw new AppError('Invalid or expired refresh token', 401);
      }

      // Check if user is active
      const user = session.user;
      if (!user.isActive || user.deletedAt) {
        throw new AppError('User account inactive', 403);
      }

      const employee = user.employee;
      if (!employee) {
        throw new AppError('User profile configuration is incomplete', 400);
      }

      // DO NOT rotate refresh token to prevent HMR/multi-tab race conditions.
      // Just extend the session's expiration date (sliding window) and issue a new access token.
      
      const payload = {
        userId: user.id,
        email: user.email,
        roleCode: employee.jobRole.code,
        permissionTier: employee.jobRole.permissionTier,
        employeeId: employee.id,
      };

      const newAccessToken = signAccessToken(payload);

      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress,
          deviceInfo: userAgent,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: token,
      };
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  /**
   * Log out user, delete the refresh token session
   */
  static async logout(token: string, userId: string, ipAddress?: string, userAgent?: string) {
    await prisma.userSession.deleteMany({
      where: { refreshToken: token },
    });

    await createAuditLog({
      actorUserId: userId,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: userId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Starts the self-service password reset.
   *
   * The raw token is NEVER returned to the caller — it travels only inside the
   * emailed link. The response is identical whether or not the address exists,
   * so the endpoint cannot be used to enumerate accounts.
   */
  static async forgotPassword(email: string) {
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email address, a password reset link has been sent to it.',
    };

    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!user || user.deletedAt || !user.isActive) {
      return genericResponse;
    }

    // Invalidate any outstanding tokens for this user.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Cryptographically random token (never Math.random).
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${token}`;
    const displayName =
      `${user.employee?.firstName ?? ''} ${user.employee?.lastName ?? ''}`.trim() || 'HRISense user';

    try {
      const { EmployeeEmailService } = await import('./email/employee-email.service');
      const outcome = await EmployeeEmailService.sendPasswordResetLink(
        user.email,
        displayName,
        resetUrl,
        RESET_TOKEN_TTL_MINUTES
      );
      if (!outcome.sent) {
        // Logged server-side only. The API response stays generic either way so
        // the caller cannot tell whether the address exists.
        console.warn(`[Auth] Password reset email not delivered: ${outcome.message}`);
      }
    } catch (err) {
      console.error('[Auth] Password reset email threw:', err);
    }

    await createAuditLog({
      actorUserId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
    });

    return genericResponse;
  }

  /**
   * Reset the password using the emailed token.
   */
  static async resetPassword(token: string, newPassword: string) {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError('This password reset link is invalid or has expired. Request a new one.', 400);
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      throw new AppError(complexity.message ?? PASSWORD_POLICY.description, 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      // Update password
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: false,
        },
      }),
      // Mark token as used
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active sessions
      prisma.userSession.updateMany({
        where: { userId: resetToken.userId },
        data: { isRevoked: true },
      }),
    ]);

    await createAuditLog({
      actorUserId: resetToken.userId,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: resetToken.userId,
    });
  }

  /**
   * Change password for a logged-in user (first login, or a normal change).
   *
   * The current password is ALWAYS verified — there is no path that skips it.
   * Complexity is enforced by `validatePasswordComplexity`, which replaced a
   * single regex literal whose escaped `\\d` demanded a literal backslash-d and
   * therefore rejected every ordinary password.
   *
   * An access token alone can therefore never change a password. On success
   * the temporary-password flag is cleared and every OTHER signed-in session of
   * the account is signed out; the session that made the change (identified by
   * `currentRefreshToken`) stays signed in. Without it, every session is signed
   * out. Nothing secret is written to the audit log.
   */
  static async changePassword(
    userId: string,
    newPassword: string,
    currentPassword?: string,
    context: { currentRefreshToken?: string; ipAddress?: string; userAgent?: string } = {}
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new AppError('User not found', 404);

    if (!currentPassword) {
      throw new AppError('Your current password is required to set a new one.', 400);
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      await createAuditLog({
        actorUserId: userId,
        action: 'PASSWORD_CHANGE_FAILED',
        entityType: 'USER',
        entityId: userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        newValue: { reason: 'current password incorrect' },
      });
      throw new AppError('The current password you entered is incorrect.', 401);
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      throw new AppError(complexity.message ?? PASSWORD_POLICY.description, 400);
    }

    const isSameAsCurrent = await comparePassword(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      throw new AppError('Your new password must be different from your current password.', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const replacedTemporaryPassword = user.mustChangePassword;

    const [, signedOut] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      // Other browsers and devices must sign in again with the new password.
      prisma.userSession.updateMany({
        where: {
          userId,
          isRevoked: false,
          ...(context.currentRefreshToken ? { NOT: { refreshToken: context.currentRefreshToken } } : {}),
        },
        data: { isRevoked: true },
      }),
    ]);

    await createAuditLog({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      newValue: { replacedTemporaryPassword, otherSessionsSignedOut: signedOut.count },
    });
  }
}
