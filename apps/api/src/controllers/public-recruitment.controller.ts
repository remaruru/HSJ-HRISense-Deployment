import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { JobOpeningService } from '../services/job-opening.service';
import { JobApplicationService } from '../services/job-application.service';
import { AppError, issuesFromZod, validationError } from '../middleware/errorHandler';
import { removeFileQuietly } from '../middleware/upload';
import { prisma } from '../config/prisma';
import {
  createApplicationStatusToken,
  verifyApplicationStatusToken,
} from '../lib/applicationStatusToken';
import fs from 'fs';
import path from 'path';

/**
 * Applicant-facing wording for each internal pipeline status.
 *
 * Internal stage names are never exposed. Anything not listed here falls back to
 * a neutral "In progress" so a new internal status can never leak.
 */
const PUBLIC_STATUS_LABELS: Record<string, { label: string; description: string }> = {
  SUBMITTED: {
    label: 'Application received',
    description: 'We have received your application and it is queued for review.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    description: 'The HR Department is currently reviewing your application.',
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    description: 'Your application has been shortlisted. HR will contact you about next steps.',
  },
  FOR_INTERVIEW: {
    label: 'For interview',
    description: 'You are being considered for an interview. HR will contact you with the details.',
  },
  INTERVIEWED: {
    label: 'Interview completed',
    description: 'Your interview has been completed and your application is being evaluated.',
  },
  FOR_REQUIREMENTS: {
    label: 'Submitting requirements',
    description: 'HR has requested additional requirements. Please check your email.',
  },
  HIRED: {
    label: 'Accepted',
    description: 'Congratulations. HR will contact you regarding your onboarding.',
  },
  REJECTED: {
    label: 'Not selected',
    description: 'Thank you for your interest. This application was not selected for the role.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    description: 'This application has been withdrawn.',
  },
};

// Import file-type safely for CJS
const fileType = require('file-type');
// Import adm-zip for safe DOCX structure inspection
const AdmZip = require('adm-zip');

/**
 * A deliberately loose phone check: digits with optional spaces, dashes,
 * brackets and a leading +, and 7–15 digits in total (the international
 * maximum). It stops letters and keyboard noise; it does not impose one
 * country's numbering plan.
 */
export function isPlausiblePhoneNumber(value: string): boolean {
  if (!/^\+?[\d\s()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

export const submitApplicationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  suffix: z.string().optional(),
  email: z.string().trim().min(1, 'Email address is required').email('Enter a valid email address, like name@example.com.'),
  mobileNumber: z
    .string()
    .trim()
    .min(1, 'Mobile number is required')
    .refine(isPlausiblePhoneNumber, 'Enter a valid mobile number using digits only, like 09171234567.'),
  presentAddress: z.string().optional(),
  // Sex and religion are OPTIONAL: blank, omitted or null is accepted and stored
  // as no value. A value that is given must be one of the listed sexes; religion
  // is a listed religion or whatever was typed under "Others".
  gender: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'], {
      errorMap: () => ({ message: 'Please choose one of the listed options for sex, or leave it blank.' }),
    }).optional()
  ),
  religion: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '') || v === null ? undefined : v,
    z.string().trim().max(120, 'Religion must be 120 characters or fewer.').optional()
  ),
  source: z.string().optional(),
  message: z.string().optional(),
  privacyConsent: z.preprocess((val) => val === 'true' || val === true, z.boolean().refine((val) => val === true, {
    message: 'Privacy consent is required',
  })),
});

export class PublicRecruitmentController {
  static async listOpenings(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, page = '1', limit = '10' } = req.query;
      
      const result = await JobOpeningService.listJobOpenings(
        { search: search as string }, 
        { page: parseInt(page as string), limit: parseInt(limit as string) },
        true // publicOnly
      );

      // Sanitize response
      const sanitizedItems = result.items.map(item => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        employmentType: item.employmentType,
        vacancies: item.vacancies,
        description: item.description,
        responsibilities: item.responsibilities,
        qualifications: item.qualifications,
        openingDate: item.openingDate,
        closingDate: item.closingDate,
        unit: { name: item.unit.name },
        department: item.department ? { name: item.department.name } : null,
      }));

      res.json({ success: true, data: { ...result, items: sanitizedItems } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /public/recruitment/positions — every Job Role at Hospicio, with the
   * openings currently accepting applications. Public-safe fields only.
   */
  static async listPositions(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await JobOpeningService.listPublicPositions();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getOpeningBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const opening = await JobOpeningService.getJobOpeningBySlug(req.params.slug, true);
      
      const sanitizedOpening = {
        id: opening.id,
        slug: opening.slug,
        title: opening.title,
        employmentType: opening.employmentType,
        vacancies: opening.vacancies,
        description: opening.description,
        responsibilities: opening.responsibilities,
        qualifications: opening.qualifications,
        requiredDocuments: opening.requiredDocuments,
        openingDate: opening.openingDate,
        closingDate: opening.closingDate,
        unit: { name: opening.unit.name },
        department: opening.department ? { name: opening.department.name } : null,
      };

      res.json({ success: true, data: sanitizedOpening });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /public/recruitment/application-status/:token
   *
   * Login-free, read-only view of ONE application.
   *
   * Exposes only public-safe information. It must never return HR notes,
   * interview notes or recommendations, ratings, communication metadata, other
   * applicants, or any employee data.
   */
  static async getApplicationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = verifyApplicationStatusToken(req.params.token);

      // A bad token and a missing application return the same response, so the
      // endpoint cannot be used to probe for valid applications.
      const notFound = () =>
        next(
          new AppError(
            'This application status link is not valid. Check the link in your email, or contact the HR Department.',
            404,
            undefined,
            'STATUS_LINK_INVALID'
          )
        );

      if (!applicationId) return notFound();

      const application = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        select: {
          referenceNumber: true,
          status: true,
          applicationDate: true,
          updatedAt: true,
          applicant: { select: { firstName: true, lastName: true } },
          jobOpening: {
            select: { title: true, referenceNumber: true, unit: { select: { name: true } } },
          },
          // Only the latest stage change, and only its timestamp — never the
          // internal reason text.
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 1,
            select: { changedAt: true, newStatus: true },
          },
        },
      });

      if (!application) return notFound();

      const latest = application.statusHistory[0];

      res.json({
        success: true,
        data: {
          referenceNumber: application.referenceNumber,
          applicantFirstName: application.applicant.firstName,
          jobTitle: application.jobOpening.title,
          jobReferenceNumber: application.jobOpening.referenceNumber,
          unitName: application.jobOpening.unit?.name ?? null,
          submittedAt: application.applicationDate,
          lastUpdatedAt: latest?.changedAt ?? application.updatedAt,
          stage: PUBLIC_STATUS_LABELS[application.status] ?? {
            label: 'In progress',
            description: 'Your application is being processed by the HR Department.',
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async apply(req: Request, res: Response, next: NextFunction) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const resume = files?.resume?.[0];
    const coverLetter = files?.coverLetter?.[0];

    const cleanupTempFiles = async () => {
      await removeFileQuietly(resume?.path, 'public application résumé');
      await removeFileQuietly(coverLetter?.path, 'public application cover letter');
    };

    try {
      // Validate Form Payload — every field problem goes back, so the form can
      // mark each one.
      const parsed = submitApplicationSchema.safeParse(req.body);
      if (!parsed.success) throw validationError(issuesFromZod(parsed.error));
      const data = parsed.data;

      const openingId = req.params.openingId;

      if (!resume) {
        throw validationError([{ field: 'resume', message: 'Please attach your résumé (PDF, DOC or DOCX).' }]);
      }

      // VALIDATE FILE EXTENSION, MIME, AND MAGIC BYTES
      const allowedExtensions = ['.pdf', '.doc', '.docx'];
      const allowedMimes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const validateFile = async (file: Express.Multer.File, label: string) => {
        // 1. Extension Check
        const finalExt = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(finalExt)) {
          throw new AppError(`The selected ${label} is not a valid PDF, DOC, or DOCX file.`, 400);
        }

        // 2. MIME Check - Only as an additional consistency check.
        if (!allowedMimes.includes(file.mimetype)) {
          throw new AppError(`The selected ${label} has an invalid MIME type.`, 400);
        }

        // 3. File Signature / Magic Bytes Check
        const buffer = await fs.promises.readFile(file.path);
        const type = await fileType.fromBuffer(buffer);

        if (!type) {
          throw new AppError(`The selected ${label} is not a valid PDF, DOC, or DOCX file.`, 400);
        }

        let isValidSignature = false;

        if (finalExt === '.pdf' && type.ext === 'pdf') {
          isValidSignature = true;
        } else if (finalExt === '.doc' && type.ext === 'cfb') {
          // CFB is Compound File Binary format used by legacy Word
          isValidSignature = true;
        } else if (finalExt === '.docx' && (type.ext === 'docx' || type.ext === 'zip')) {
          // We must verify the Office Open XML archive structure manually
          // to prevent generic ZIPs from masquerading as DOCX.
          try {
            const zip = new AdmZip(file.path);
            const entries = zip.getEntries();
            
            // Defend against excessive entries (ZIP bomb vector mitigation)
            if (entries.length === 0) {
              throw new Error('Empty ZIP archive');
            }
            if (entries.length > 500) {
              throw new Error('Excessive archive entry count');
            }

            let hasContentTypes = false;
            let hasWordDocument = false;

            for (const entry of entries) {
              // Note: AdmZip provides entry names using forward slashes safely.
              const name = entry.entryName;
              
              // Defend against path traversal
              if (name.includes('../') || name.includes('..\\') || name.startsWith('/') || name.startsWith('\\')) {
                throw new Error('Path traversal detected in archive');
              }
              
              // We only inspect entry names. No decompression expansion occurs here.
              if (name === '[Content_Types].xml') {
                hasContentTypes = true;
              }
              if (name.startsWith('word/')) {
                hasWordDocument = true;
              }
            }

            if (!hasContentTypes || !hasWordDocument) {
              throw new Error('Missing required Office Open XML DOCX structure');
            }
            
            isValidSignature = true;
          } catch (zipErr: any) {
            console.error(`[SECURITY_AUDIT] DOCX ZIP inspection failed for ${label}: ${zipErr.message}`);
            throw new AppError(`The selected ${label} is corrupted or not a valid Word document.`, 400);
          }
        }

        if (!isValidSignature) {
          console.error(`[SECURITY_AUDIT] Signature mismatch for ${label}. Final Ext: ${finalExt}, Detected Ext: ${type.ext}`);
          throw new AppError(`The selected ${label} is not a valid PDF, DOC, or DOCX file.`, 400);
        }
      };

      await validateFile(resume, 'résumé');
      if (coverLetter) {
        await validateFile(coverLetter, 'cover letter');
      }

      // Submit application
      const application = await JobApplicationService.submitPublicApplication({
        ...data,
        openingId,
        resume,
        coverLetter
      });

      res.status(201).json({
        success: true,
        message: 'Your application has been submitted successfully.',
        data: {
          referenceNumber: application.referenceNumber,
          // Login-free, read-only status link. No applicant account is created.
          statusToken: createApplicationStatusToken(application.id),
        },
      });
    } catch (err) {
      // Nothing was saved (validation, a refused opening, a duplicate, or a
      // failed transaction), so the uploaded files are orphans: remove them,
      // then answer through the shared error handler.
      await cleanupTempFiles();
      next(err);
    }
  }
}
