import { Router } from 'express';
import { JobOpeningController } from '../controllers/job-opening.controller';
import { JobApplicationController } from '../controllers/job-application.controller';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

// Job Openings
router.get('/overview', JobOpeningController.overview);
router.get('/openings', JobOpeningController.list);
router.post('/openings', JobOpeningController.create);
router.get('/openings/:id', JobOpeningController.getById);
router.patch('/openings/:id', JobOpeningController.update);
router.patch('/openings/:id/status', JobOpeningController.changeStatus);

// Internal Application Processing
router.get('/applications', JobApplicationController.listApplications);
router.get('/applications/:id', JobApplicationController.getApplicationById);
router.patch('/applications/:id/status', JobApplicationController.changeStatus);
router.post('/applications/:id/notes', JobApplicationController.addNote);
router.get('/applications/:id/documents/:documentId/download', JobApplicationController.downloadDocument);
router.get('/applications/:id/documents/:documentId/preview', JobApplicationController.previewDocument);
router.post('/applications/:id/interviews', JobApplicationController.scheduleInterview);
router.patch('/applications/:id/interviews/:interviewId', JobApplicationController.updateInterview);
router.patch('/applications/:id/interviews/:interviewId/reschedule', JobApplicationController.rescheduleInterview);
router.get('/applications/:id/communications', JobApplicationController.listCommunications);
router.post('/applications/:id/communications', JobApplicationController.sendEmail);
router.post('/applications/:id/communications/preview', JobApplicationController.previewEmail);
router.post('/applications/:id/communications/:communicationId/retry', JobApplicationController.retryCommunication);
router.post('/applications/:id/convert', JobApplicationController.convertToOnboarding);

export default router;
