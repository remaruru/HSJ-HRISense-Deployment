# HRISense Recruitment Manual QA Checklist

This document provides step-by-step procedures to manually verify the Recruitment module across the complete hiring lifecycle. Do not mark checks as passed until verified in the running application.

## 1. Environment & Roles
- [ ] Log in as an Administrator (Full technical access).
- [ ] Log in as an HR Officer (Full recruitment management authority).
- [ ] Log in as an HR Staff (Limited recruitment review authority).
- [ ] Log in as a Department Supervisor (View/Interview only authority).
- [ ] Ensure Brevo credentials (if any) are set safely in `.env` and `EMAIL_PROVIDER` is set to `SIMULATED` or `BREVO`.

## 2. Public Careers & Application
- [ ] Verify the "Careers" link is visible on the Landing Page.
- [ ] View the Careers page (`/careers`); verify only `PUBLISHED` (or `OPEN`) job openings are listed.
- [ ] Verify Draft, Closed, Filled, and Archived openings are hidden.
- [ ] Click on a job opening and verify details load correctly (`/careers/$openingSlug`).
- [ ] Click "Apply" and submit the form with valid fields and a valid résumé PDF.
- [ ] Attempt to submit the form without the required privacy consent and verify denial.
- [ ] Attempt to upload an invalid file type or size and verify the upload is blocked.
- [ ] Submit an application and confirm the applicant is redirected to the submission success page.
- [ ] Ensure the public success page displays a tracking reference but NO database IDs.
- [ ] Verify there is no applicant portal, no login generated, and no tracking route exposed.
- [ ] Test the application form on a mobile viewport layout.

## 3. Internal Recruitment Overview
- [ ] Log in as HR and navigate to the Recruitment Overview.
- [ ] Verify the summary metrics (Openings, Applications, Interviews) display actual database data.
- [ ] Verify the Sidebar displays "Recruitment" sections accurately based on permission tiers.
- [ ] Verify expanding and collapsing the Sidebar preserves Recruitment navigation.

## 4. Job Openings Management
- [ ] Create a new Job Opening and save it as a Draft.
- [ ] Edit the Job Opening and update its details.
- [ ] Publish the Job Opening and verify it appears on the public Careers page.
- [ ] Mark the opening as Closed/Filled and confirm it is removed from public view.

## 5. Applicant Review & Status
- [ ] Navigate to the Applicants list and verify the new application appears.
- [ ] Test list filters (Status, Opening) and verify they work.
- [ ] Click on the applicant to view the Applicant Detail page.
- [ ] View and securely download the applicant's résumé.
- [ ] Change the application status and provide an optional internal note.
- [ ] Verify the status history logs the change correctly.
- [ ] Verify that unauthorized roles cannot download documents or change statuses.

## 6. Interview Management
- [ ] In the Applicant Detail page, schedule a new interview.
- [ ] Reschedule the interview and verify the time and "RESCHEDULED" status are correctly recorded.
- [ ] Verify that rescheduling does not automatically alter the main `JobApplication` status.
- [ ] Edit the interview to mark it as `COMPLETED`, adding interviewer notes and a recommendation.

## 7. HR-Controlled Communications
- [ ] Open the "Compose Email" dialog in the Applicant Detail page.
- [ ] Select a template (e.g., Interview Invitation or Application Accepted) and verify the preview correctly replaces placeholders.
- [ ] Customize the email body and explicitly confirm sending.
- [ ] Verify the email appears in the communications list as `SENT` or `SIMULATED`.
- [ ] Verify that no email is sent automatically upon application submission.
- [ ] Verify that no email is sent automatically when changing application statuses.
- [ ] (If applicable) Test the retry button for a safely generated `FAILED` email record.

## 8. OnboardingDraft Conversion
- [ ] Mark the applicant as `HIRED`.
- [ ] Click "Convert to Onboarding".
- [ ] Verify the confirmation dialog warns that only a Draft is created (no User/Employee records).
- [ ] Confirm conversion succeeds and displays a success state with the Draft ID.
- [ ] Click "Resume Draft" and verify navigation routes to `/employees/onboard?draftId=...` correctly loading the data.
- [ ] Verify `mobilePhone` (not just mobileNumber) is transferred to the onboarding draft.
- [ ] Attempt to convert the same applicant again and verify the system blocks duplicate conversion.
- [ ] Verify no Employee, User account, or credentials were automatically generated during conversion.

## 9. Layout, Theme & Responsiveness
- [ ] View all Recruitment pages in Light Mode. Ensure tables, cards, text, and dialogs are readable and use standard HRISense colors.
- [ ] View all Recruitment pages in Dark Mode. Ensure contrast and readability match standard HRISense dark theme.
- [ ] Test the Job Openings and Applicants tables on Tablet and Mobile viewports for horizontal overflow.
- [ ] Open the Composer and Interview dialogs on Mobile and confirm they scroll within the viewport.
- [ ] Confirm empty states (e.g., No Interviews, No Communications) render properly instead of throwing errors.

## 10. Security & Data Privacy
- [ ] Verify applicant information is never leaked in the URL (except non-sensitive identifiers like application IDs).
- [ ] Confirm applicant data is not pushed to LocalStorage or unauthenticated external APIs (like LLMs).
- [ ] Verify HR roles are explicitly required for all internal API endpoints via `RecruitmentPolicy`.
- [ ] Check API responses in Developer Tools to confirm provider secrets (e.g., Brevo API keys) are not exposed to the frontend.
\n## Upload Defenses (Manual Testing)\n- [ ] Attempt 31 application submissions locally -> Expect HTTP 429.\n- [ ] Upload `.exe` renamed to `.pdf` -> Expect HTTP 400 Signature Mismatch.\n