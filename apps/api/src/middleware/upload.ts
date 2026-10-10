import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { AppError } from './errorHandler';

/**
 * Shared, authoritative upload middleware factory for HRISense.
 *
 * All protected uploads go through this module so that filename randomisation,
 * MIME allow-listing and the executable blocklist are defined exactly once.
 * Files are written to `<cwd>/uploads/<subdir>` which is intentionally NOT
 * served statically — every download is streamed through an authenticated route.
 */

/** Document-style attachments (PDF / images / Word). */
export const DOCUMENT_MIME_ALLOWLIST = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Profile photos only. */
export const IMAGE_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Extensions that are rejected regardless of the declared MIME type.
 * A browser can be told to send any Content-Type, so the extension is checked too.
 */
export const FORBIDDEN_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll',
  '.js', '.mjs', '.cjs', '.ts', '.php', '.py', '.rb', '.pl',
  '.jar', '.ps1', '.vbs', '.htaccess',
];

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function resolveUploadDir(subdir: string): string {
  const dir = path.join(process.cwd(), 'uploads', subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

interface CreateUploadOptions {
  /** Folder under `uploads/`, e.g. `documents`. */
  subdir: string;
  /** Allowed MIME types. Defaults to the document allowlist. */
  allowedMimeTypes?: string[];
  /** Per-file byte limit. Defaults to 5 MB. */
  maxFileSizeBytes?: number;
  /** Maximum number of files in one request. */
  maxFiles?: number;
  /**
   * Message shown when the type is rejected. The default names the document
   * formats, which is wrong for an uploader that accepts something else.
   */
  typeErrorMessage?: string;
}

/**
 * Builds a multer instance writing randomised filenames into `uploads/<subdir>`.
 */
export function createDiskUpload(options: CreateUploadOptions) {
  const {
    subdir,
    allowedMimeTypes = DOCUMENT_MIME_ALLOWLIST,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
    maxFiles,
    typeErrorMessage = 'Invalid file type. Only PDF, JPG, PNG, WEBP, DOC and DOCX files are allowed.',
  } = options;

  const destination = resolveUploadDir(subdir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  });

  const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
    // Lets the error handler name this upload's real limit if a file exceeds it.
    (req as typeof req & { uploadMaxBytes?: number }).uploadMaxBytes = maxFileSizeBytes;
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new AppError(typeErrorMessage, 400));
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      return cb(new AppError('Executable and script files are strictly prohibited.', 400));
    }

    cb(null, true);
  };

  return multer({
    storage,
    limits: maxFiles ? { fileSize: maxFileSizeBytes, files: maxFiles } : { fileSize: maxFileSizeBytes },
    fileFilter,
  });
}

/**
 * Best-effort removal of files already written to disk when the surrounding
 * database work fails. Never throws — cleanup must not mask the original error.
 */
export function cleanupUploadedFiles(files: Array<{ path?: string } | undefined | null>): void {
  for (const file of files) {
    if (!file?.path) continue;
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.error('[Upload Cleanup] Failed to remove orphaned file:', file.path, err);
    }
  }
}

/**
 * Async best-effort removal of one stored file. A file that is already gone is
 * fine; any other failure is logged (an orphan to clean up later) but never
 * thrown, so it cannot hide the error that triggered the cleanup.
 */
export async function removeFileQuietly(filePath: string | undefined | null, context: string): Promise<void> {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[Upload Cleanup] Could not remove ${context} at ${filePath}:`, (err as Error)?.message ?? err);
    }
  }
}

/** Flattens the `Request.files` object produced by `upload.fields()`. */
export function flattenMulterFields(
  files: Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined
): Express.Multer.File[] {
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return Object.values(files).flat();
}
