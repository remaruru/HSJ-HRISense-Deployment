import { assertLoginEmailAvailable, normalizeLoginEmail } from '../services/employee-contact-details';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { UserService } from '../services/user.service';
import { createAuditLog } from '../lib/audit';

/**
 * HR Account Management — the single authoritative surface for acting on an
 * employee's login account.
 *
 * Routes are employee-centric (`/employees/:id/account/*`) because that is how HR
 * works and how the 201 profile is organised. Every handler resolves the linked
 * `User` from the employee, so the caller never needs a user id.
 */
export class AccountController {
  /** Resolves the linked user for an employee, or fails with a clear message. */
  private static async resolveUser(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        personalEmail: true,
        deletedAt: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!employee) throw new AppError('Employee not found', 404);
    if (!employee.user) {
      throw new AppError('This employee does not have a HRISense login account.', 400);
    }
    return { employee, user: employee.user };
  }

  /** GET /employees/:id/account — account snapshot for the panel. */
  static async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await UserService.getAccountForEmployee(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees/:id/account/use-personal-email
   *
   * Accounts created before the personal email became the login may still sign
   * in with an older address. HR switches them here, explicitly — the migration
   * never changed anyone's login on its own.
   */
  static async usePersonalEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);
      const email = normalizeLoginEmail(employee.personalEmail);
      if (!email) throw new AppError('Record a personal email first; it becomes the login email.', 400);
      if (email.toLowerCase() === user.email.toLowerCase()) {
        return res.json({ success: true, message: 'The login email already is the personal email.', data: { email: user.email } });
      }
      await assertLoginEmailAvailable(email, employee.id);
      await prisma.user.update({ where: { id: user.id }, data: { email } });
      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'ACCOUNT_LOGIN_EMAIL_CHANGED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { from: user.email, to: email, reason: 'HR switched the login to the personal email.' },
      });
      res.json({ success: true, message: `The employee now signs in with ${email}.`, data: { email } });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/account/activate */
  static async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);
      const updated = await UserService.updateStatus(user.id, true);

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'ACTIVATE_USER',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: { isActive: updated.isActive },
        message: 'Account activated. The employee can sign in again.',
      });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/account/deactivate */
  static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);

      if (req.user!.employeeId === employee.id) {
        throw new AppError('You cannot deactivate your own account.', 400);
      }

      const updated = await UserService.updateStatus(user.id, false);

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'DEACTIVATE_USER',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: { isActive: updated.isActive },
        message: 'Account deactivated and all active sessions signed out.',
      });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/account/lock */
  static async lock(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);

      if (req.user!.employeeId === employee.id) {
        throw new AppError('You cannot lock your own account.', 400);
      }

      const { lockedUntil } = await UserService.lockAccount(user.id);

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'ACCOUNT_LOCKED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email, lockedUntil },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: { lockedUntil },
        message: `Account locked until ${lockedUntil.toLocaleString('en-PH')}.`,
      });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/account/unlock */
  static async unlock(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);
      await UserService.unlockAccount(user.id);

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'ACCOUNT_UNLOCKED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, message: 'Account unlocked and failed sign-in attempts cleared.' });
    } catch (err) {
      next(err);
    }
  }

  /** POST /employees/:id/account/force-password-change */
  static async forcePasswordChange(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);
      await UserService.forcePasswordChangeFlag(user.id);

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'FORCE_PASSWORD_CHANGE',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message:
          'The employee will be required to set a new password the next time they sign in. Existing sessions were signed out.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /employees/:id/account/reset-password
   *
   * Issues a NEW temporary password. HRISense never stores plaintext passwords,
   * so an existing password can never be re-sent — a reset is the only way to
   * give an employee working credentials again.
   *
   * `sendEmail` (default true) additionally emails the new credentials.
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee, user } = await AccountController.resolveUser(req.params.id);
      const shouldEmail = req.body?.sendEmail !== false;

      const { temporaryPassword, email, employeeName } = await UserService.forcePasswordReset(user.id);

      // Credentials go to the employee's personal address when one is on file —
      // the same rule as the onboarding welcome email. The login ID is unchanged.
      const deliveryEmail = employee.personalEmail?.trim() || email;

      let emailSent = false;
      let emailMessage: string | null = null;
      if (shouldEmail) {
        try {
          const { EmployeeEmailService } = await import('../services/email/employee-email.service');
          const outcome = await EmployeeEmailService.sendResetCredentialsEmail(
            deliveryEmail,
            employeeName,
            email,
            temporaryPassword
          );
          emailSent = outcome.sent;
          emailMessage = outcome.message;
        } catch (emailErr) {
          console.error('[Account] Reset credentials email failed:', emailErr);
          emailMessage = `The email could not be delivered to ${deliveryEmail}. Give the temporary password to the employee directly.`;
        }
      }

      await createAuditLog({
        actorUserId: req.user!.userId,
        targetEmployeeId: employee.id,
        action: 'RESET_PASSWORD',
        entityType: 'USER',
        entityId: user.id,
        // The password itself is never written to the audit trail.
        metadata: { email: user.email, emailSent, emailRecipient: deliveryEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: { temporaryPassword, emailSent, emailMessage },
        message: 'A new temporary password has been issued and all sessions were signed out.',
      });
    } catch (err) {
      next(err);
    }
  }
}
