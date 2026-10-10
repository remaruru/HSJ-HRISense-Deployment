import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateTemporaryPassword, hashPassword } from '../lib/password';

/** How long an HR-initiated account lock lasts, in minutes. */
const MANUAL_LOCK_MINUTES = 60;

export class UserService {
  private static async getActiveUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        },
      },
    });
    if (!user || user.deletedAt) throw new AppError('User account not found', 404);
    return user;
  }

  /**
   * HR-initiated password reset.
   *
   * Issues a brand-new crypto-generated temporary password (HRISense never stores
   * plaintext, so an existing password can never be re-sent), forces a change at
   * next sign-in, clears any lock, and revokes every active session.
   */
  static async forcePasswordReset(userId: string) {
    const user = await UserService.getActiveUser(userId);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.userSession.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    return {
      temporaryPassword,
      email: user.email,
      employeeName: user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
        : user.email,
    };
  }

  /** Enable or disable login access. Deactivating also revokes live sessions. */
  static async updateStatus(userId: string, isActive: boolean) {
    await UserService.getActiveUser(userId);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          isActive,
          // Reactivating clears the failure counter and any lock.
          ...(isActive ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
        },
      });

      if (!isActive) {
        await tx.userSession.updateMany({
          where: { userId },
          data: { isRevoked: true },
        });
      }

      return user;
    });

    return updated;
  }

  /** Manually lock an account for MANUAL_LOCK_MINUTES and revoke its sessions. */
  static async lockAccount(userId: string) {
    await UserService.getActiveUser(userId);

    const lockedUntil = new Date(Date.now() + MANUAL_LOCK_MINUTES * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });
      await tx.userSession.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
      return user;
    });

    return { user: updated, lockedUntil };
  }

  /** Clear a lock and reset the failed-attempt counter. */
  static async unlockAccount(userId: string) {
    await UserService.getActiveUser(userId);

    return prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  /**
   * Require a password change at next sign-in without issuing a new password.
   * Existing sessions are revoked so the flag is honoured immediately.
   */
  static async forcePasswordChangeFlag(userId: string) {
    await UserService.getActiveUser(userId);

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { mustChangePassword: true },
      });
      await tx.userSession.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
      return user;
    });

    return updated;
  }

  /** Read-only account snapshot for the HR Account Management panel. */
  static async getAccountForEmployee(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            lockedUntil: true,
            failedLoginAttempts: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!employee) throw new AppError('Employee not found', 404);
    return employee;
  }
}
