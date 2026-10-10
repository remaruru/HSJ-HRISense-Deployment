# Landing Page Completion and Public Website Polish Phase

This plan outlines the redesign and completion of the HRISense Landing Page to meet the capstone presentation requirements for Hospicio de San Jose.

## User Review Required

> [!WARNING]
> **Missing Capstone Team Information**
> We are missing the required capstone team details to finalize the 3 team member cards in the "About Us" section. I scoured the repository (docs, README, SQL files, package.json) but could only confirm "Earl Angelo Roldan" as Project Leader & Lead Developer. 
> 
> **Please provide the following exact information for all 3 members to finalize this section:**
> 1. Full Names
> 2. Capstone Roles
> 3. Student Number or Contact Number (and specify which label to use)
> 4. Email Address
> 5. (Optional) Specialization or Contribution

## Open Questions

- Should we include the `FAQ` section that currently exists on the Landing Page, or replace it entirely with the newly structured sections? I plan to keep it at the end unless instructed otherwise.

## Proposed Changes

### `apps/web/src/pages/Landing/LandingPage.tsx`
#### [MODIFY] LandingPage.tsx
- **Theme & Colors:** Apply strict `primary` (#148281) branding, reducing excessive glass/neon effects for a more professional, human-centered feel.
- **Sticky Public Navigation:** Add all required anchor links (`Home`, `Features`, `How It Works`, `About`, `Our Team`) with smooth scrolling and mobile menu support. Preserve `Careers` and `Login` routes.
- **Hero Section:** Update wording to exact capstone specifications ("Smarter Workforce Insights. More Human-Centered HR Management."). Add functioning primary/secondary CTAs (`Explore HRISense`, `View Careers`, `Sign In`).
- **Project Overview:** Add a concise section clarifying HRISense's AI-assisted, decision-support nature designed for Hospicio de San Jose.
- **Core System Capabilities:** Restructure existing `_4` features into accurate, verified module cards (Employee Management, Attendance, Leave, AI Intelligence, etc.).
- **Personalized Roles:** Update existing `b4` section to match verified access models (Admin, HR, Supervisor, Employee).
- **How HRISense Works:** Create a new 4-step process flow section.
- **AI-Assisted Decision Support:** Update existing `y4` section. Clarify that AI does *not* make automated decisions, but provides summaries for HR review.
- **About the Capstone:** Add a new section emphasizing the project's academic nature and its beneficiary.
- **About Us / Team Section:** Create the structure for three team cards. *(Execution of these exact cards will wait until missing contact info is provided)*.
- **Careers CTA:** Add a dedicated call-to-action block linking to `/careers`.
- **Final Login CTA:** Add a final "Already part of Hospicio de San Jose?" block linking to `/login`.
- **Complete Footer:** Build a robust footer with proper anchor links, correct routes, year, and capstone disclosure.

### `docs/LANDING_PAGE_COMPLETION_AUDIT.md`
#### [NEW] LANDING_PAGE_COMPLETION_AUDIT.md
- **Landing Completion Audit:** Generate a detailed breakdown of the button/link audit, placeholder removal, theme review, responsive review, accessibility review, and manual QA checks to be performed.

### `docs/ANTIGRAVITY_DEVELOPMENT_PROGRESS.md`
#### [MODIFY] ANTIGRAVITY_DEVELOPMENT_PROGRESS.md
- **Progress Tracking:** Log the completion of the Landing Page Polish Phase.

## Verification Plan

### Automated Tests
- Run `npm run build` in `apps/web` to ensure no TypeScript or bundling errors.

### Manual Verification
- A comprehensive manual QA checklist will be provided in the new `LANDING_PAGE_COMPLETION_AUDIT.md` for visual and functional verification across Desktop, Tablet, Mobile, Light Mode, and Dark Mode.
