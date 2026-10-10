# Manual QA Checklist: Phase 5 - 8
## Target Audience: HR Administrators & Supervisors

This document outlines the mandatory browser-based Manual QA pass required before releasing the Holiday Calendar, Work Scheduling, and Attendance Integration features.

### 1. Holiday Calendar
- [ ] Log in as an HR Administrator (`permissionTier: FULL`).
- [ ] Navigate to **Attendance -> Holiday Calendar**.
- [ ] Click **Load API Suggestions** and confirm that Nager.Date holidays for the current year are populated as `Pending`.
- [ ] Approve a pending holiday. Verify the status changes to `Approved`.
- [ ] Ignore a pending holiday. Verify the status changes to `Ignored`.
- [ ] Create a Manual Entry. Verify it is created successfully and defaults to `Approved`.
- [ ] Click the **Deactivate** (trash) icon on the Manual Entry. Verify the status changes to `Deactivated`.
- [ ] Ensure that `Deactivated` or `Ignored` entries do NOT appear in the Daily Monitoring view.

### 2. Schedule Templates
- [ ] Navigate to **Attendance -> Schedule Templates**.
- [ ] Create a new Template (e.g., "Standard Mon-Fri"). Set Monday-Friday as Working days (08:00 to 17:00), and leave Saturday-Sunday unconfigured (or configure as Rest Days).
- [ ] Verify you can successfully save the template.
- [ ] Edit the template to revise the hours. Set an effective date for the revision (e.g., next Monday).
- [ ] Verify the revision is saved as a new version (e.g., v2) and the old version is preserved.
- [ ] Archive a template. Verify it no longer appears as an option for new employee onboarding.

### 3. Employee Profile & Onboarding Schedule Assignment
- [ ] Navigate to **Employees -> Onboarding Drafts** (or click Add Employee).
- [ ] Proceed to Step 4 (Work Schedule). Select the newly created Schedule Template.
- [ ] Submit the onboarding form.
- [ ] Navigate to the Employee's Profile -> **Schedule** tab.
- [ ] Verify the selected Template is active and displayed under "Current Schedule".
- [ ] Click **Reassign Template** and select a different template. Verify the change is reflected in the Schedule History.


### 4. Daily Monitoring Integration
- [ ] Navigate to **Attendance -> Daily Monitoring**.
- [ ] Verify the Calendar View aggregates accurately (e.g., if you created a holiday, the `HOL` chip should appear on that date).
- [ ] Click on a specific date to open the **Day Drawer**.
- [ ] Verify the **Schedule** column displays the contextual schedule (e.g., "08:00 - 17:00", "DAY OFF", or "UNCONFIGURED").
- [ ] If the date is a holiday, verify the **Holiday** chip appears next to the Status column.
- [ ] Use the **Organization Filters -> Status Filter** and select `Holiday`. Verify it accurately filters employees who are affected by the holiday.
- [ ] Select `Rest Day`. Verify it accurately filters employees who have that day configured as non-working.
