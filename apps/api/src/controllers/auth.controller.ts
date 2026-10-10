import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { GoogleAuthService } from '../services/google-auth.service';
import { CaptchaService } from '../services/captcha.service';
import { loginCaptcha } from '../services/login-captcha';
import { captchaEnabled } from '../config/env';

/** Tells the sign-in page to show the "I'm not a robot" checkbox (exposed through CORS). */
const CAPTCHA_HEADER = 'X-Captcha-Required';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    /** The "I'm not a robot" result — only needed after repeated failed sign-ins. */
    captchaToken: z.string().max(4096).optional(),
  }),
});

/** Only Google's signed ID token — never an email, name or role from the browser. */
export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string().min(100, 'Google sign-in did not return a credential').max(4096),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  })
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      // Canonical field name across frontend and backend. `oldPassword` is accepted
      // as a legacy alias so older clients keep working, but one of them MUST be
      // supplied — the current password is always verified.
      currentPassword: z.string().optional(),
      oldPassword: z.string().optional(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      // The web UI sends this and checks it client-side, but the API used to
      // drop it silently: a request with a MISMATCHED confirmation still
      // returned 200 and changed the password to `newPassword`. Any non-browser
      // client was therefore unprotected. Optional so existing clients that omit
      // it keep working; enforced whenever it is supplied.
      confirmPassword: z.string().optional(),
      // The session making the change stays signed in; every other one is
      // signed out. Optional: without it, every session is signed out.
      refreshToken: z.string().optional(),
    })
    .refine(
      (b) => b.confirmPassword === undefined || b.confirmPassword === b.newPassword,
      {
        message: 'The new password and its confirmation do not match.',
        path: ['confirmPassword'],
      }
    ),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, captchaToken } = req.body;
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];

      // After repeated failures for this email or from this network, the
      // checkbox must be passed before the password is even checked.
      if (captchaEnabled && loginCaptcha.isRequired(email, ip)) {
        res.setHeader(CAPTCHA_HEADER, 'true');
        await CaptchaService.verify(captchaToken, ip);
      }

      let result;
      try {
        result = await AuthService.login(email, password, ip, userAgent);
      } catch (error) {
        // Wrong password, unknown email, locked or deactivated: all count alike,
        // so the checkbox never reveals whether an account exists.
        if (captchaEnabled && error instanceof AppError && (error.statusCode === 401 || error.statusCode === 403)) {
          if (loginCaptcha.recordFailure(email, ip)) res.setHeader(CAPTCHA_HEADER, 'true');
        }
        throw error;
      }
      loginCaptcha.recordSuccess(email);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /** GET /auth/captcha-config — whether the "I'm not a robot" checkbox is on, and the public site key. */
  static async captchaConfig(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: CaptchaService.config() });
  }

  /** GET /auth/google/config — whether Google Sign-In is on, and the public Client ID. */
  static async googleConfig(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: GoogleAuthService.config() });
  }

  /** POST /auth/google — sign in to an existing account with Google's ID token. */
  static async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await GoogleAuthService.signIn(req.body.credential, req.ip, req.headers['user-agent']);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      // Counted by googleUnregisteredLimiter: repeated ones block this IP.
      if (error instanceof AppError && error.code === 'GOOGLE_NO_ACCOUNT') res.locals.googleUnregistered = true;
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refresh(refreshToken, ip, userAgent);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];

      if (userId) {
        await AuthService.logout(refreshToken, userId, ip, userAgent);
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      await AuthService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      // Fetch employee and role information
      const employee = await prisma.employee.findUnique({
        where: { id: user.employeeId },
        include: {
          jobRole: true,
        },
      });

      if (!employee) {
        throw new AppError('Employee record not found', 404);
      }

      // The account row carries the forced-password-change flag. It MUST be part
      // of this payload — the frontend route guard reads it, and omitting it let a
      // simple page refresh bypass the mandatory first-login password change.
      const account = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { mustChangePassword: true, isActive: true, email: true },
      });

      if (!account) {
        throw new AppError('User account not found', 404);
      }
      if (!account.isActive) {
        throw new AppError('Your account has been deactivated. Contact HR.', 403);
      }

      // Fetch user's permissions
      const permissionsRelations = await prisma.rolePermission.findMany({
        where: { jobRoleId: employee.jobRoleId },
        include: { permission: true },
      });
      
      const permissions = permissionsRelations.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}.${rp.permission.scope}`
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId,
            email: account.email,
            mustChangePassword: account.mustChangePassword,
            permissions,
            permissionTier: employee.jobRole.permissionTier,
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
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { newPassword } = req.body;
      // `currentPassword` is canonical; `oldPassword` is the legacy alias.
      const currentPassword: string | undefined = req.body.currentPassword ?? req.body.oldPassword;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Your session has expired. Please sign in again.', 401);
      }

      await AuthService.changePassword(userId, newPassword, currentPassword, {
        currentRefreshToken: typeof req.body.refreshToken === 'string' ? req.body.refreshToken : undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
