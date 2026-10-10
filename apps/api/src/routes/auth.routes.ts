import { Router, type RequestHandler } from 'express';
import {
  AuthController,
  loginSchema,
  googleLoginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  googleUnregisteredLimiter,
  loginAccountLimiter,
  loginIpLimiter,
  passwordChangeLimiter,
  passwordRecoveryLimiter,
  refreshLimiter,
} from '../middleware/rate-limit';

const router = Router();

// Sign-in is limited per IP and per IP + email. Account lockout (five wrong
// passwords) still applies on top — the two do different jobs.
router.post('/login', loginIpLimiter, loginAccountLimiter, validate(loginSchema), asyncHandler(AuthController.login));

// Google Sign-In: counts against the same per-IP sign-in limit as passwords,
// and repeated attempts with unregistered emails block Google sign-in for that IP.
// The custom header is required because a cross-site form cannot send it, so
// another site cannot post a sign-in on the user's behalf.
const requireXhr: RequestHandler = (req, _res, next) => {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') return next(new AppError('Invalid sign-in request.', 400));
  next();
};
router.get('/google/config', asyncHandler(AuthController.googleConfig));
router.get('/captcha-config', asyncHandler(AuthController.captchaConfig));
router.post('/google', loginIpLimiter, googleUnregisteredLimiter, requireXhr, validate(googleLoginSchema), asyncHandler(AuthController.googleLogin));
router.post('/refresh', refreshLimiter, validate(refreshSchema), asyncHandler(AuthController.refresh));
router.post('/logout', authenticate, validate(refreshSchema), asyncHandler(AuthController.logout));
router.post('/forgot-password', passwordRecoveryLimiter, validate(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', passwordRecoveryLimiter, validate(resetPasswordSchema), asyncHandler(AuthController.resetPassword));

router.use(authenticate);
router.get('/me', asyncHandler(AuthController.getMe));
router.post('/change-password', passwordChangeLimiter, validate(changePasswordSchema), asyncHandler(AuthController.changePassword));

export default router;
