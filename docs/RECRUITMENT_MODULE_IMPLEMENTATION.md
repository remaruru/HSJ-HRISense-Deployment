# HRISense Recruitment Module Implementation

## Recent Fixes
### Public Application Submission HTTP 500 Fix (August 2026)
- Corrected a missing directory creation step in Multer diskStorage which caused `ENOENT` 500 errors on file uploads.
- Strengthened file validation with explicit MIME type checking (PDF, DOC, DOCX).
- Cleaned up error responses (replacing 500s with safe 400/409 validation failures) for both API output and Frontend presentation on the application page.

## Repository Findings
- Existing architecture clearly splits `Employee` from pre-hiring models (`OnboardingDraft`).
- Documents are handled via `EmployeeDocument`, but require mapping to applicant context prior to hiring.
- `schema.prisma` successfully modified to include Recruitment models.

## Confirmed Requirements
- Create JobOpenings, Applicants, JobApplications, ApplicantInterviews, ApplicantNotes, ApplicantDocuments.
- Implement Centralized Hiring Authorization Policy.
- The HR Officer is the normal final hiring authority. PermissionTier FULL provides broad system access but does not by itself prove that the user is the HR Officer.
- **Admin**: May retain technical system access but must not be identified as the normal hiring decision-maker.
- **HR Assistant/Staff**: Screening and administrative access only by default.
- **SUPERVISOR / STANDARD**: No Recruitment access by default.
- No direct applicant-to-employee creation. Use `OnboardingDraft` conversion.

## No Applicant Account or Portal
- No applicant account
- No applicant registration
- No applicant login
- No applicant password
- No applicant dashboard
- No applicant portal
- No application tracking page
- No applicant self-service interview scheduling
*The applicant only views openings, completes the form, uploads a résumé, submits, and sees a submission confirmation. All later communication is sent by HR through email.*

## Phase Order
- **Phase 1** — Repository Inspection and Requirements
- **Phase 2** — Database and Backend Foundation (Currently **BLOCKED** by Prisma migration history)
- **Phase 3** — Internal Job Openings
- **Phase 4** — Public Careers and Application Submission
- **Phase 5** — Internal Applicants and Application Review
- [x] Phase 6: Interview Scheduling and Management UI
- [x] Phase 7: HR-Controlled Applicant Email Communication UI
- [x] Phase 8: Applicant-to-OnboardingDraft Conversion UI
- [x] Phase 9: Final Audit and Adjustments, Reports, Theme Review, Documentation, and Final Build Verification
## Unresolved Hospicio Policies
- Whether HR Assistant and HR Staff may publish openings
- Whether HR Assistant and HR Staff may reject applicants
- Whether only HR Officer may mark HIRED
- Whether Department Heads participate in interviews
- Whether job openings require an approval process
- Which applicant documents are required
- Applicant-data retention period
- Whether applicants receive interview, rejection, or hiring emails
- Whether interviews use formal scoring forms
- Whether medical and psychological checks occur before or after the final hiring decision
- Whether closed openings may be reopened

## Permission Policy
```typescript
// Proposed concept to be implemented
export const RecruitmentPolicy = {
  canPublishOpening: (user) => user.permissionTier === 'FULL', // Pending confirmation
  canFinalizeHire: (user) => user.permissionTier === 'FULL',
  canReviewApplications: (user) => user.permissionTier === 'FULL' || user.permissionTier === 'SUPERVISOR', // Restricted based on HR roles
  // ...
};
```

## Database Models & Enums
- Enums: `JobOpeningStatus`, `JobApplicationStatus`, `InterviewType`, `InterviewStatus`.
- Models: `JobOpening`, `Applicant`, `JobApplication`, `ApplicantDocument`, `ApplicantInterview`, `ApplicationStatusHistory`, `ApplicantNote`.

## Status Transitions
- `SUBMITTED` -> `UNDER_REVIEW` -> `SHORTLISTED` -> `FOR_INTERVIEW` -> `INTERVIEWED` -> `FOR_REQUIREMENTS` -> `HIRED` / `REJECTED` / `WITHDRAWN`.

## Public Routes
- `/careers`
- `/careers/$openingSlug`
- `/careers/$openingSlug/apply`
- `/careers/application-success`
*(Note: After submission, the applicant only sees a success confirmation: "Your application has been submitted successfully. Hospicio de San Jose Human Resources will contact you through the email address or mobile number you provided regarding the next steps." No tracking or login link is provided.)*

## Protected Routes
- `/recruitment`
- `/recruitment/openings`
- `/recruitment/openings/new`
- `/recruitment/openings/$openingId`
- `/recruitment/openings/$openingId/edit`
- `/recruitment/applicants`
- `/recruitment/applicants/$applicationId`

## File-upload rules & Résumé transfer approach
- **Public Upload**: Max 5MB, strict MIME checks.
- **Storage**: Secured storage path not publicly exposed.
- **Transfer to Onboarding**: A safe transfer method will be implemented to preserve access authorization, preserve applicant traceability, avoid orphan files, hide storage paths, and prevent duplicate physical copies. The Employee document will only be created after onboarding completes.

## Field-mapping table (Pending Final Confirmation)
*Note: Do not treat these proposed field names as confirmed. The actual `EmployeeOnboardingPage`, Draft save request, Draft resume logic, and JSON structure must be inspected first.*
| Applicant/Application field | OnboardingDraft field |
| --- | --- |
| Applicant First Name | firstName |
| Applicant Last Name | lastName |
| Applicant Email | personalEmail (To be verified) |
| Applicant Mobile | mobilePhone (To be verified) |
| Applicant Address | presentAddress (To be verified) |
| Job Opening Unit | unitId |
| Job Opening Dept | departmentId |
| Job Opening Job Role | jobRoleId |
| Job Opening Emp Type | employmentStatus (To be verified) |

Conversion must create an OnboardingDraft only. It must not directly create an Employee, User, Employee number, Temporary password, or Employee credentials.
## Files Created & Modified
- `apps/api/prisma/schema.prisma` (Modified)

## Migration Status
**Phase 2 Status: Migration baseline recovery completed.**
Prisma migration baseline `00000000000000_hrisense_baseline` was generated. The Recruitment module migration `20260730193348_add_recruitment_module` and `20260730204659_add_applicant_communication` were successfully deployed.
The real database `hrisense_db` is clean and correctly tracked.

## Build Results
- `npm run build` in apps/api completes successfully with type safety validated across the new policy and provider implementation, as well as Phase 4 public apply modifications.
- `npm run build` in apps/web completes successfully with the new Phase 4 routing, careers list, job application detail, apply form, and success pages.

## Remaining Work
- Implement Phase 5 (Internal Applicant Review Frontend).
- Complete Phases 6 through 9 in the exact specified order.

## HR-to-Applicant Email Communication Feature
This module includes a transactional email provider abstraction (e.g., `RecruitmentEmailProvider` using Brevo) to allow HR to communicate with applicants manually without creating applicant accounts.

### Recruitment Communication Workflow
1. Applicant views OPEN job opening and submits application on public careers page.
2. Application appears internally. HR reviews the application.
3. HR manually updates internal status and optionally opts to send an email. (Status change and email are separate actions).
4. HR selects a template, previews the recipient, subject, and body.
5. HR edits the message if necessary and confirms send.
6. Backend calls configured email provider. The exact subject and body snapshot is saved in `ApplicantCommunication` history.
7. Acceptance/Rejection/Interview emails are completely manual. NO automatic decision emails are sent. A configurable submission receipt may be the only automatic email. Mark applicant HIRED, sending acceptance email, and converting to OnboardingDraft remain separate manual actions.

### Email Types
Editable templates will be provided for:
- `APPLICATION_RECEIVED`
- `UNDER_REVIEW`
- `SHORTLISTED`
- `INTERVIEW_INVITATION`
- `INTERVIEW_RESCHEDULED`
- `INTERVIEW_CANCELLED`
- `ADDITIONAL_REQUIREMENTS`
- `APPLICATION_ACCEPTED`
- `APPLICATION_NOT_SELECTED`
- `CUSTOM_MESSAGE`

Do not expose internal rejection reasons, HR notes, interview scores, or recommendations in external messages.

### Brevo/Provider Architecture
- Use a provider abstraction `RecruitmentEmailProvider` with implementations like `BrevoRecruitmentEmailProvider` and `DevelopmentRecruitmentEmailProvider`.
- Configure using explicit backend environment variables: `RECRUITMENT_EMAIL_PROVIDER`, `RECRUITMENT_EMAIL_SEND_ENABLED`, `RECRUITMENT_EMAIL_TEST_RECIPIENT`, `BREVO_API_KEY`, `RECRUITMENT_FROM_EMAIL`, `RECRUITMENT_FROM_NAME`, `RECRUITMENT_REPLY_TO_EMAIL`.
- Ensure API keys are never exposed in frontend code, Git, DB records, docs, audit logs, or error responses.
- Do not couple development safety to `EmailService.isDevSeededAccount`. Use explicit environment-controlled settings.

### Communication Database Model (To be added after migration repair)
```prisma
model ApplicantCommunication {
  id                     String         @id @default(uuid())
  jobApplicationId       String
  jobApplication         JobApplication @relation(fields: [jobApplicationId], references: [id])
  communicationType      String
  channel                String         @default("EMAIL")
  recipientEmail         String
  recipientName          String
  subjectSnapshot        String
  bodySnapshot           String         @db.Text
  provider               String?
  providerMessageId      String?
  sendStatus             String         // DRAFT, SENDING, SENT, FAILED, SIMULATED
  sentByUserId           String
  sentAt                 DateTime?
  failedAt               DateTime?
  failureCode            String?
  failureReason          String?        @db.Text
  retryOfCommunicationId String?
  createdAt              DateTime       @default(now())
  updatedAt              DateTime       @updatedAt

  @@index([jobApplicationId])
  @@map("applicant_communications")
}
```
*Note: Do not use DELIVERED, BOUNCED, or BLOCKED unless provider webhooks are genuinely implemented. A successful Brevo API response is SENT.*

### Protected Email Endpoints
- `GET /api/v1/recruitment/applications/:applicationId/communications`
- `POST /api/v1/recruitment/applications/:applicationId/communications/preview`
- `POST /api/v1/recruitment/applications/:applicationId/communications/send`
- `POST /api/v1/recruitment/communications/:communicationId/retry`
*All endpoints require authentication, Recruitment authorization, server-side template validation, and content sanitization.*

### Permission Rules (Communication)
- **HR Officer**: Send all email types (acceptance, not-selected, requirements, interview updates).
- **HR Assistant/Staff**: Send administrative updates, application acknowledgement, interview invites, requirement reminders. (No final acceptance/rejection unless confirmed by Hospicio).
- **Admin**: No sender/decision-maker presentation.
- **SUPERVISOR / STANDARD**: No access.

### Template Placeholders
Templates support server-side validation and sanitization for:
`{{applicantName}}`, `{{applicationReference}}`, `{{jobTitle}}`, `{{interviewDate}}`, `{{interviewTime}}`, `{{interviewLocation}}`, `{{meetingLink}}`, `{{hrContactName}}`, `{{hrContactEmail}}`, `{{nextSteps}}`, `{{requirements}}`.

### Communication History
The Applicant Detail page displays an "Email History" section showing type, recipient, subject, sender, date, status, failure information (when safe), a "View Message" action, and a "Retry" action for failed sends.
**ApplicantNote** and **ApplicantCommunication** remain completely separate. Internal notes are private HR records. Communications are external messages sent to the applicant.

### Failure and Retry Behavior
Status changes and emails are separate actions. If an email fails:
- Do not reverse the application status.
- Record the failed attempt.
- Display an error in the UI.
- Allow HR to click "Retry".

### Development Email Safety
- Use explicit environment-controlled development settings (e.g., `RECRUITMENT_EMAIL_SEND_ENABLED=false`, `RECRUITMENT_EMAIL_TEST_RECIPIENT`).
- In development mode: do not send to real applicants unless explicitly enabled, allow redirecting to a test recipient, and mark communication clearly as `SIMULATED`.
- Do not falsely record a simulated message as genuinely `SENT`.

### Build and Code Verification
- [ ] Allowed commands: `npm run build` in apps/api/web, `npx prisma validate`, static code inspection, safe migration replay. (Do not run automated tests).
- [ ] Applicant has no account or portal.
- [ ] Application appears in HR Recruitment.
- [ ] HR can select an email template.
- [ ] Subject and message can be edited.
- [ ] HR must confirm before sending.
- [ ] Status change alone sends no email.
- [ ] Interview details populate correctly.
- [ ] Internal notes are not included.
- [ ] Rejection reasons are not exposed.
- [ ] Acceptance email does not create an Employee.
- [ ] Acceptance email does not create an OnboardingDraft.
- [ ] Conversion remains a separate action.
- [ ] Failed email is recorded and can be retried.
- [ ] Email history displays correctly.
- [ ] Unauthorized users cannot send.
- [ ] API key is absent from frontend responses and logs.
- [ ] Development mode does not contact real applicants.

## Exact Next Step
- Proceed to Phase 5 (Internal Applicant Review Frontend).

## Compact Continuation Prompt
"HRISense Recruitment Phase 4 frontend completed with public Careers listings, public job details, a validated résumé-based application form, required privacy consent, and a submission-confirmation flow connected to the verified Recruitment backend. No applicant account, portal, login, tracking page, or automated hiring decision was created. Internal applicant review, interviews, email communication UI, and onboarding conversion UI remain pending for the next phases."
\n## Public Upload Security\n- express-rate-limit used for endpoint protection.\n- file-type used for structural PDF/DOC/DOCX validation.\n- fs.promises.unlink used for failure cleanup.\n