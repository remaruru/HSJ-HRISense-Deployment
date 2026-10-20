import { Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller';
import { AccountController } from '../controllers/account.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { createDiskUpload, DOCUMENT_MIME_ALLOWLIST, IMAGE_MIME_ALLOWLIST } from '../middleware/upload';

const router = Router();

/**
 * Onboarding upload parser.
 *
 * The onboarding wizard posts `multipart/form-data`; without this middleware the
 * body was never parsed and employee creation silently received an empty object.
 * Field names mirror `EmployeeOnboardingPage.tsx` exactly.
 */
const onboardingUpload = createDiskUpload({
  subdir: 'documents',
  allowedMimeTypes: [...new Set([...DOCUMENT_MIME_ALLOWLIST, ...IMAGE_MIME_ALLOWLIST])],
  maxFileSizeBytes: 5 * 1024 * 1024, // 5 MB per file
  maxFiles: 21,
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'contract', maxCount: 1 },
  { name: 'governmentIds', maxCount: 10 },
  { name: 'otherDocuments', maxCount: 10 },
]);

// All employee routes require authentication
router.use(authenticate);

// ─── Utility & Export Routes (specific paths before :id) ───────────────────────
router.get('/org-chart', EmployeeController.getOrgChart);
// Additional (secondary) oversight on the Org Chart — managed by HR; grants no access.
router.get('/additional-oversight', authorize(['FULL']), EmployeeController.listAdditionalOversight);
router.post('/additional-oversight', authorize(['FULL']), EmployeeController.addAdditionalOversight);
router.delete('/additional-oversight/:oversightId', authorize(['FULL']), EmployeeController.removeAdditionalOversight);
router.get('/units', EmployeeController.getUnits);
router.get('/job-roles', EmployeeController.getJobRoles);
router.get('/eligible-supervisors', authorize(['FULL']), EmployeeController.getEligibleSupervisors);
router.post('/resolve-supervisor', authorize(['FULL']), EmployeeController.resolveSupervisor);
router.post('/bulk-restore', authorize(['FULL']), EmployeeController.bulkRestore);

// ─── Export Routes ────────────────────────────────────────────────────────────
router.get('/export/excel', authorize(['FULL', 'SUPERVISOR']), EmployeeController.exportExcel);
router.post('/export/excel', authorize(['FULL', 'SUPERVISOR']), EmployeeController.exportExcel);
router.get('/export/pdf', authorize(['FULL', 'SUPERVISOR']), EmployeeController.exportPDF);
router.post('/export/pdf', authorize(['FULL', 'SUPERVISOR']), EmployeeController.exportPDF);

// ─── Own Profile / Subordinates ───────────────────────────────────────────────
router.get('/me', EmployeeController.getMe);

// The person's own profile photo and banner (any signed-in person, own record only).
const profileImageUpload = createDiskUpload({
  subdir: 'documents',
  allowedMimeTypes: IMAGE_MIME_ALLOWLIST,
  typeErrorMessage: 'Choose a JPG, PNG or WEBP image.',
}).single('file');
router.post('/me/photo', profileImageUpload, EmployeeController.setMyProfileImage('photo'));
router.post('/me/banner', profileImageUpload, EmployeeController.setMyProfileImage('banner'));
router.delete('/me/banner', EmployeeController.removeMyBanner);
router.get('/subordinates', authorize(['FULL', 'SUPERVISOR']), EmployeeController.getSubordinates);

// ─── Employee Directory List & Creation ────────────────────────────────────────
router.get('/', authorize(['FULL', 'SUPERVISOR']), EmployeeController.list);
router.post('/', authorize(['FULL']), onboardingUpload, EmployeeController.create);

// ─── Single Employee (wildcard :id routes) ────────────────────────────────────
router.get('/:id/additional-oversight', authorize(['FULL']), EmployeeController.employeeAdditionalOversight);
router.post('/:id/additional-oversight', authorize(['FULL']), EmployeeController.addEmployeeAdditionalOversight);
router.get('/:id', EmployeeController.getById);
router.put('/:id', EmployeeController.update);
router.delete('/:id', authorize(['FULL']), EmployeeController.remove);
router.patch('/:id/archive', authorize(['FULL']), EmployeeController.remove);
router.patch('/:id/restore', authorize(['FULL']), EmployeeController.bulkRestore);

// ─── Supervisor Override Operations ───────────────────────────────────────────
router.post('/:id/supervisor-override', authorize(['FULL']), EmployeeController.overrideSupervisor);
router.delete('/:id/supervisor-override', authorize(['FULL']), EmployeeController.removeSupervisorOverride);

// ─── Employee Timeline (audit history for this employee) ──────────────────────
router.get('/:id/timeline', EmployeeController.getTimeline);
// Profile as a PDF: HR for anyone, everyone else for their own record only.
router.get('/:id/export/pdf', EmployeeController.exportProfilePdf);
router.get('/:id/profile-completion', EmployeeController.getProfileCompletion);

// ─── HR Account Management (single authoritative account surface) ─────────────
router.get('/:id/account', authorize(['FULL']), AccountController.getAccount);
router.post('/:id/account/activate', authorize(['FULL']), AccountController.activate);
router.post('/:id/account/use-personal-email', authorize(['FULL']), AccountController.usePersonalEmail);
router.post('/:id/account/deactivate', authorize(['FULL']), AccountController.deactivate);
router.post('/:id/account/lock', authorize(['FULL']), AccountController.lock);
router.post('/:id/account/unlock', authorize(['FULL']), AccountController.unlock);
router.post('/:id/account/force-password-change', authorize(['FULL']), AccountController.forcePasswordChange);
router.post('/:id/account/reset-password', authorize(['FULL']), AccountController.resetPassword);

export default router;
