# Public Recruitment Upload Security Audit

## 1. Threat Model
The public recruitment application endpoints are vulnerable to various attack vectors since they accept anonymous file uploads and data submissions. The primary threats addressed in this phase include:
- **Automated Application Spam**: Bots submitting thousands of fake applications to exhaust database storage or disrupt HR processes.
- **Storage Exhaustion**: Uploading massively oversized files or unexpected additional files to consume local disk space.
- **Disguised Malicious Files**: Uploading executable payloads (e.g., `.exe`, `.bat`) disguised with `.pdf` or `.docx` extensions to compromise internal systems.
- **Duplicate Abuse**: Re-applying constantly to the same position to flood the HR pipeline.

## 2. Current Local Development Architecture
HRISense is currently running as a local single-instance API during development. Rate limiting is implemented using an in-memory store. Document storage utilizes the server's local private disk, and applicant document preview/download endpoints are protected by the backend.

## 3. Existing Protections Before Phase
- Duplicate application prevention (same email/mobile for the same active opening).
- Basic temporary file cleanup on database failure.
- Multer file size limitation.
- Randomized disk storage filenames preventing path traversal.
- Protected internal HR endpoints.

## 4. Rate-Limit Architecture
Rate limiting is implemented using `express-rate-limit` as middleware on the public Express routes. The rate limiters run **before** the Multer multipart upload middleware to ensure that abusive requests are rejected prior to processing any file streams or writing to disk.

## 5. Public Careers GET Limits
- **Endpoint**: `GET /api/v1/public/recruitment/openings`
- **Limit**: 60 requests per minute per IP.
- **Purpose**: Prevents basic scraping/flooding while remaining generous for legitimate job seekers.

## 6. Public Application POST Limit
- **Endpoint**: `POST /api/v1/public/recruitment/openings/:openingId/apply`
- **Production Default Limit**: 5 requests per hour per IP.
- **Purpose**: Strictly limits resource-heavy requests (multipart parsing, db transaction, email trigger).

## 7. Local Development Behavior
In local development (`NODE_ENV=development` or unset), the application POST limit is relaxed to 30 requests per hour per IP to facilitate manual testing by developers sharing the `127.0.0.1` address.

## 8. In-Memory Store Limitation
The rate limit uses an in-memory store. Counters will reset when the Node.js API process restarts. This is adequate for the current local single-instance capstone phase. Future multi-instance deployments will require a distributed store (e.g., Redis).

## 9. File Count
- **Resume**: Exactly 1 required file.
- **Cover Letter**: Maximum 1 optional file.
- **Total Uploads**: Max 2 files. 
- Implemented via `multer` limits and strict field checking. Unexpected files (e.g., third files) trigger a `LIMIT_UNEXPECTED_FILE` rejection.

## 10. File Size
- **Max File Size**: 5 MB per file.
- **Total Upload Size**: ~10 MB total.

## 11. Allowed Formats
Only the following formats are allowed:
- Portable Document Format (PDF)
- Microsoft Word Document (DOC)
- Microsoft Word Open XML Format (DOCX)

## 12. Extension Validation
File extensions are checked case-insensitively on the *final* extension (`path.extname()`). Double extensions (e.g., `resume.pdf.exe`) are securely identified by their final `.exe` extension and rejected.

## 13. MIME Validation
The server verifies the uploaded multipart `mimetype` to ensure it matches the allowed list (`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).

## 14. File-Signature Validation
Using the `file-type` library, the backend inspects the actual file magic bytes (file signature) of the uploaded temp file before moving forward:
- PDFs must return structurally as `pdf`.
- Legacy DOCs must return structurally as `cfb` (Compound File Binary).
- DOCX files must return structurally as `docx` or `zip`. If identified as `zip`, the Office Open XML archive structure is safely inspected (without decompression expansion) to ensure it contains required elements like `[Content_Types].xml` and `word/` entries. Missing structure or zip anomalies (e.g. excessive entries, path traversal) result in rejection.
A mismatch between the allowed extension and actual structural signature results in an immediate HTTP 400 rejection.

## 15. Random Filename Generation
Uploaded files are stored using a 16-byte cryptographically random identifier + validated extension. The original filename is sanitized and saved to the database metadata for HR display, preventing path traversal and name collision attacks.

## 16. Local Private Disk Storage
Applicant files are stored in `uploads/recruitment/documents`. This directory is strictly outside of the frontend `apps/web/public` directory and is NOT exposed through `express.static`. It cannot be accessed via a direct public URL.

## 17. Protected Preview
Inline PDF previews are supported through HR internal endpoints, requiring HRISense user authentication, Recruitment policy authorization, and correct application ownership. The endpoints enforce `Content-Type: application/pdf` and `X-Content-Type-Options: nosniff` securely.

## 18. Protected Download
File downloads utilize the same strict backend authorization checks. The physical file paths are never exposed to the client.

## 19. Duplicate Application Prevention
The `JobApplicationService` intercepts applications matching the same active opening and same normalized applicant identifiers (email/mobile). It raises a 409 Conflict early in the business logic flow.

## 20. Failure Cleanup
If any validation fails (Form, Extension, Signature) or if a database transaction aborts, the controller triggers a robust `fs.promises.unlink` cleanup on the temporary staged files, preventing orphan uploads from consuming local disk space.

## 21. Orphan-File Considerations
In the rare event of a hard Node.js process crash during file staging (before cleanup can execute), an orphan file might remain on disk. Given the local single-instance constraints, automated cron-based cleanup for these orphans is deferred as a future production maintenance strategy.

## 22. HTTP 429 Behavior
When a rate limit is exceeded, the server returns an HTTP 429 Too Many Requests response safely. The `ApplyPage` frontend intercepts this status and displays an applicant-friendly message without clearing their form data.

## 23. Security Logging
Major validation failures (e.g., signature mismatch) and abusive upload attempts are safely logged to the server console.

## 24. Manual QA Checklist
*(For local developer verification only)*
- [ ] Attempt 31 application submissions locally -> Expect HTTP 429 Too Many Requests.
- [ ] Attempt to upload an `.exe` renamed to `.pdf` (Unsupported file) -> Expect HTTP 400 Signature Mismatch.
- [ ] Attempt to upload a 6MB PDF (Oversized file) -> Expect HTTP 400 File Size Limit error.
- [ ] Attempt to upload a Valid PDF -> Expect accepted.
- [ ] Attempt to upload a Valid legacy DOC -> Expect accepted.
- [ ] Attempt to upload a Valid DOCX -> Expect accepted.
- [ ] Attempt to upload an Ordinary ZIP renamed to .docx -> Expect HTTP 400 Signature Mismatch (missing Office structure).
- [ ] Attempt to upload a Corrupted DOCX -> Expect HTTP 400 Corrupted error.
- [ ] View `uploads/recruitment/documents` directory -> Confirm randomized filenames.

## 25. Known Limitations
- Rate limits reset upon server restarts.
- DOCX validation inspects ZIP entry headers (e.g., `[Content_Types].xml`) safely in memory to prevent arbitrary ZIP uploads, but does not deeply execute or parse the XML contents.

## 26. CAPTCHA — Future Production Enhancement
Cloudflare Turnstile or CAPTCHA implementation is EXPLICITLY outside the current capstone scope and may be introduced during production deployment.

## 27. Antivirus — Outside Current Scope
Dedicated malware scanning (e.g., ClamAV, VirusTotal) is EXPLICITLY outside the current capstone scope. The current defenses mitigate automated spam and disguised file types. 

## 28. Distributed Rate Limiting — Future Production Enhancement
Implementing a Redis-backed distributed rate limiter is outside the current scope and would be required if deploying across multiple API instances.
