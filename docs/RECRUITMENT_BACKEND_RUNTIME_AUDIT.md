# Recruitment Backend Runtime Audit

## Recent Fixes
### Public Application Submission HTTP 500
- **HTTP 500 defect**: The `POST /api/v1/public/recruitment/openings/:id/apply` endpoint returned 500 Internal Server Error when applicants submitted a valid form with a résumé.
- **Exact root cause**: Multer attempted to store files in `uploads/recruitment/documents` but because a function was used for the `destination` parameter of `multer.diskStorage`, the directory was not automatically created. The unhandled `ENOENT` error threw a 500 before reaching the controller logic. Furthermore, generic `Error` instances in validation checks (e.g. "Resume document is required") were mapped to 500s.
- **Failing operation**: `multer.diskStorage` missing directory creation, coupled with generic validation `Error` throwing in controllers.
- **Request-contract finding**: Frontend keys matched the backend validator. Privacy consent (boolean) was parsed accurately by Zod `preprocess`.
- **Database finding**: The Prisma transaction successfully isolates applicant creation, application submission, and document attachment.
- **File finding**: Allowed MIME types were not checked, leading to potential security vulnerabilities. Added `fileFilter` for PDF/DOC/DOCX. File cleanup properly executed in `job-application.service.ts` if transactions failed, preventing orphaned files.
- **Error-handler finding**: `errorHandler.ts` was not mapping `MulterError` and `INVALID_FILE_TYPE` to 400.
- **Correction**: 
  - Added `fs.mkdirSync` with `recursive: true` in `multer.diskStorage` destination callback.
  - Implemented `fileFilter` to reject non-whitelisted documents with `INVALID_FILE_TYPE`.
  - Replaced generic `Error` throws in `job-application.service.ts` and `public-recruitment.controller.ts` with `AppError(..., 400|404|409)` so validation safely triggers a 400 response.
  - Updated `errorHandler.ts` to capture `MulterError` and `INVALID_FILE_TYPE` as 400 Bad Requests.
  - Corrected frontend `ApplyPage.tsx` to handle 400 status codes gracefully rather than showing raw Axios 500 error strings.
- **Focused runtime results**: A valid submission successfully creates an Applicant (or reuses one), a JobApplication, and attached ApplicantDocuments, returning a safe 201 with only the `referenceNumber`.
- **Remaining manual checks**: None for the core public application flow.
