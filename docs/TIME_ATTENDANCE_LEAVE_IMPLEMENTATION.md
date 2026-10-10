# Time & Attendance + Leave Management Implementation

## Summary
This document records the implementation of the Time & Attendance and Leave Management module for HRISense, implemented in the session dated 2026-08-07.

---

## Leave Approval Workflow (LOCKED)

**Current leave approval is restricted to `FULL` (HR) permission tier only.**

Workflow enforced:

| Role            | Action                              |
|-----------------|-------------------------------------|
| STANDARD        | File own leave only                 |
| SUPERVISOR      | File own leave; view team (read-only) |
| FULL (HR)       | View all; Approve; Reject           |

No supervisor approval, recommendation, or multi-stage approval chain was introduced. This matches the existing backend authorization on `PATCH /leave/:id/approve` and `PATCH /leave/:id/reject`, which are protected by `authorize(['FULL'])`.

> **Note:** If Hospicio later confirms a supervisor recommendation/approval stage, this must be implemented by extending backend routes and adding approval chain logic. Do NOT add this without explicit confirmation.

---

## Scope Enforcement

Scopes are validated server-side in `LeaveService.resolveScope()` and `AttendanceService`:

| Scope Requested | STANDARD | SUPERVISOR | FULL |
|-----------------|----------|------------|------|
| (none passed)   | `own`    | `own`      | `own`|
| `self`          | `own`    | `own`      | `own`|
| `team`          | ❌ HTTP 403| ✅ `team`    | `team`|
| `all`           | ❌ HTTP 403| ❌ HTTP 403  | `all`|

**Authorization Fix**: Invalid explicit scope requests (e.g. STANDARD asking for `scope=all`) now throw an explicit HTTP 403 Forbidden error rather than silently defaulting to `own`. This ensures clear RBAC boundaries, easier frontend debugging, and explicit failure of privilege escalation attempts. Default scopes (when no scope param is sent) safely resolve to `own`.

Supervisors using `scope=team` receive only employees linked via the `SupervisionLink` table (confirmed `isActive: true` where `supervisorId === requestingEmployeeId`). The explicit resolver is:

```typescript
const subordinateIds = await prisma.supervisionLink
  .findMany({
    where: { supervisorId: requestingEmployeeId, isActive: true },
    select: { subordinateId: true },
  })
```
This guarantees employees sharing only a Unit or Department are NOT included. Supervisor access is strictly limited to confirmed subordinates.

---

## Calendar Overlap Query

Calendar events use a correct date-overlap query:

```typescript
startDate: { lte: endDate },     // leave starts before or on range end
endDate: { gte: startDate },     // leave ends after or on range start
```

This correctly handles:
- Leave that started last month and ends this month
- Leave that started this month and ends next month
- Leave that spans the entire viewed month

The calendar range is also bounded to a maximum of 6 months per request.

---

## Calendar Status Display Rules

| Status     | Displayed on Calendar | Visual Style        |
|------------|----------------------|---------------------|
| APPROVED   | ✅ Yes               | Primary color chip  |
| PENDING    | ✅ Yes               | Amber/warning chip  |
| REJECTED   | ❌ No                | In history only     |
| CANCELLED  | ❌ No                | In history only     |

Each event chip shows a status dot AND status text label. Color alone is not relied upon.

---

## Supervisor Calendar Privacy

**Team Calendar (Supervisor):**
- Shows: Employee name, Leave type, Date range, Status
- Does NOT show: Reason, HR notes, attachments, sensitive documentation
- Day drawer includes notice: "Full details are accessible to HR only."

**HR Calendar:**
- Full details accessible via Leave Request Detail drawer

---

## New Request — Employee Linking

- New Request form resolves the authenticated user's Employee record from `user.employee`
- The requesting employee is displayed as a **read-only identity panel** (no dropdown)
- If `user.employee` is null/undefined: Safe state is shown — "No employee profile is linked to this account." No leave can be filed.
- Admin accounts without an Employee record cannot file personal leave.

---

## Employee.workSchedule — Structure & Limitations

### What is stored:
`Employee.workSchedule` is a **Prisma enum** (`WorkSchedule`) stored on the `employees` table.

### Enum values:
| Enum Value            | Label                 | Start     | End       |
|-----------------------|-----------------------|-----------|-----------|
| `REGULAR_DAY_SHIFT`   | Regular Day Shift     | 8:00 AM   | 5:00 PM   |
| `FLEXIBLE_SHIFT`      | Flexible Shift        | Flexible  | Flexible  |
| `NIGHT_SHIFT`         | Night Shift           | 10:00 PM  | 6:00 AM   |
| `ROTATING_SHIFT`      | Rotating Shift        | Varies    | Varies    |
| `PART_TIME_MORNING`   | Part-Time Morning     | 8:00 AM   | 12:00 PM  |
| `PART_TIME_AFTERNOON` | Part-Time Afternoon   | 1:00 PM   | 5:00 PM   |

### What it does NOT store:
- Date-specific schedule entries
- Daily override records
- Rest day assignments per date
- Schedule histories
- Per-employee shift customizations beyond the template

### Limitation documented:
> Date-specific work schedule management (individual shift overrides, rest day assignments per date) is NOT implemented in this phase and requires a dedicated schedule data structure (a new `WorkShiftAssignment` or similar model).

The Work Schedule page shows the assigned template accurately in **read-only mode**. No schedule editing controls were added.

---

## Daily Monitoring

- Shows `AttendanceRecord` entries from the database (imported data)
- Date picker with Previous/Next/Today controls
- No real-time biometric connection exists — stated clearly in UI
- "On Leave" status is shown only when the `AttendanceRecord.status` is `ON_LEAVE`; missing attendance records are NOT treated as leave
- Scope: FULL=all, SUPERVISOR=own+subordinates, STANDARD=own only

---

## Calendar Component (CalendarGrid.tsx)

Location: `apps/web/src/components/ui/CalendarGrid.tsx`

Features:
- CSS Grid, 7 columns
- Supports 6-week months (42 cells); does NOT hardcode 35 cells
- Correct leading/trailing month dates (greyed out)
- Today indicator (filled circle)
- Event chips with status dot + text
- `+X more` overflow → opens Day Detail drawer
- Previous / Today / Next month navigation
- Keyboard/focus accessible (Enter/Space on cells)
- Loading skeleton state
- Error state
- Status legend
- Light and Dark mode via CSS variables

### Multi-day Leave:
Multi-day leave (e.g., Aug 12–15) appears on all 4 days via:
```typescript
const isDateInRange = (date, start, end) => date >= start && date <= end
```

### Date-only Safety:
All dates parsed with:
```typescript
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, no UTC shift
}
```

---

## Route Order Safety

### `leave.routes.ts`:
```
GET /balances   ← first
GET /calendar   ← BEFORE /:id
GET /           
POST /
GET /:id        ← AFTER static routes
PATCH /:id/approve
PATCH /:id/reject
PATCH /:id/cancel
```

### `attendance.routes.ts`:
```
GET /summary/today  ← first
GET /schedule       ← BEFORE /:id
GET /logs
GET /
PUT /:id            ← AFTER static routes
```

Neither `calendar` nor `schedule` will be consumed by parameterized `/:id` routes.

---

## Files Created/Modified

### Backend (apps/api)
| File | Action |
|------|--------|
| `src/services/leave.service.ts` | Modified — scope resolution, calendar overlap query, SUPERVISOR support |
| `src/controllers/leave.controller.ts` | Modified — added `getCalendar` action |
| `src/routes/leave.routes.ts` | Modified — added `GET /calendar`, correct order |
| `src/services/attendance.service.ts` | Modified — added `getSchedules()`, expanded `list()` filters |
| `src/controllers/attendance.controller.ts` | Modified — added `getSchedules` action |
| `src/routes/attendance.routes.ts` | Modified — added `GET /schedule`, correct order |

### Frontend (apps/web)
| File | Action |
|------|--------|
| `src/components/ui/CalendarGrid.tsx` | Created — custom CSS-grid calendar |
| `src/pages/Attendance/DailyMonitoringPage.tsx` | Created |
| `src/pages/Attendance/WorkSchedulePage.tsx` | Created |
| `src/pages/Leave/LeaveRequestsPage.tsx` | Created |
| `src/pages/Leave/NewLeaveRequestPage.tsx` | Created |
| `src/pages/Leave/LeaveCalendarPage.tsx` | Created |
| `src/routeTree.tsx` | Modified — new routes added |
| `src/components/layout/Sidebar.tsx` | Modified — updated links |

---

## Build Status
- API: ✅ `npm run build` passes
- Web: ✅ `npm run build` passes

---

## Manual QA Pending

### Route Safety
- [ ] `GET /leave/calendar` resolves correctly, NOT treated as id = "calendar"
- [ ] `GET /attendance/schedule` resolves correctly, NOT consumed by parameter route

### Calendar Range
- [ ] Leave begins before month, ends inside month → appears correctly
- [ ] Leave begins inside month, ends next month → appears correctly
- [ ] Leave spans entire selected month
- [ ] Month requiring 6 calendar rows renders correctly
- [ ] February (28/29 days) renders correctly
- [ ] Leap year date handling
- [ ] Month change: December → January

### Scope Enforcement
- [ ] STANDARD manually requesting scope=all → blocked by server
- [ ] STANDARD manually requesting another employee's data → blocked
- [ ] SUPERVISOR scope=team → only confirmed subordinates returned
- [ ] SUPERVISOR arbitrary outside-team employee → blocked
- [ ] FULL → organization-wide visibility

### Leave New Request
- [ ] STANDARD with employee record → can file leave
- [ ] SUPERVISOR with employee record → can file leave
- [ ] FULL/HR with employee record → can file leave
- [ ] Admin account with NO employee record → safe state shown, cannot file

### Calendar Privacy
- [ ] Supervisor team calendar: reason NOT shown in day drawer
- [ ] Employee own calendar: own events only
- [ ] HR calendar: filters work, full details accessible

### Authorization
- [ ] STANDARD scope=self → succeeds
- [ ] STANDARD scope=team → 403
- [ ] STANDARD scope=all → 403
- [ ] SUPERVISOR scope=self → succeeds
- [ ] SUPERVISOR scope=team → succeeds
- [ ] SUPERVISOR scope=all → 403
- [ ] Supervisor querying unrelated employee → denied
- [ ] FULL scope=all → succeeds

### HR Calendar Filters
- [ ] Unit filter
- [ ] Department filter
- [ ] Employee filter
- [ ] Leave Type filter
- [ ] Status filter
- [ ] Unit → Department dependency (cascading resets)
- [ ] Filters do not bypass server authorization

### Leave Date Count
- [ ] Same-day leave
- [ ] Multi-day leave
- [ ] Weekend-spanning leave
- [ ] No unconfirmed holiday/rest-day calculation logic is applied
- [ ] UI wording accurately reflects that the value is "Selected Calendar Days" (not chargeable days)

---

## Known Limitations

1. **Work Schedule**: Only assigned template (enum) is stored. Date-specific overrides, rest days per date, and schedule history require a new database table.
2. **Attendance import**: No biometric connection. Records are from imported data only. `lastImportedAt` timestamp is not tracked in current schema.
3. **Leave Day Count (NOT CONFIRMED)**: The initial Mon–Sat calculation was an unconfirmed assumption. It has been removed from backend and frontend logic. The system now uses a pure inclusive calendar-day preview. The UI states: *"Chargeable leave-day computation based on Hospicio holidays, rest days, and leave policy requires Hospicio confirmation."*
4. **Leave Balance**: If no `LeaveBalance` record exists for an employee+year+type, no balance is shown. No default balance is fabricated.
5. **Supervisor Approval**: Not implemented. Approval is HR/FULL only. Requires Hospicio confirmation before adding.

---

## DAILY MONITORING CALENDAR
- **HR Organization Calendar**: Uses a `CalendarGrid` layout plotting aggregated attendance records (`Present`, `Late`, `Absent`, `On Leave`, `Half Day`, `Holiday`, `Rest Day`, `Suspended`).
- **Attendance Status summaries**: Primary summary cards display `Present`, `Late`, `Absent`, and `On Leave`. A compact secondary summary block conditionally displays `Half Day`, `Holiday`, `Rest Day`, and `Suspended` if their counts for the selected day are greater than zero.
- **HR Organization Filters**: Unit -> Department -> Employee cascading filters to scope the calendar. Changing unit resets department/employee.
- **Supervisor Team Calendar**: Displays `My Attendance` and `Team Attendance` tabs. Team calendar leverages `SupervisionLink` table (active relationships where supervisor is the current employee) and plots team aggregates. No unrelated department staff.
- **Employee Self Calendar**: Displays only the employee's personal attendance.
- **Drill-Down / Day Drawer**: Clicking any date opens a drawer showing actual row-level details (`Employee`, `Schedule`, `Status Info`, `Time In`, `Time Out`) authorized by the current scope.
- **Empty / No-Import Behavior**: Missing records are displayed as "No imported records" or "—". HRISense never infers that missing records = absent.

## MUSTARD SEEDTIME EXCEL IMPORT (PLACEHOLDER)
- **Known Workflow**: Biometric -> Mustard Seedtime -> HR Excel export -> Upload to HRISense -> Processing.
- **Unknown Structure**: Exact Excel structure, headers, date formats, time encodings, and row schemas are currently unknown.
- **Implementation (Placeholder)**: A polished modal is available to HR (only). It allows selecting an `.xls` or `.xlsx` file, but **does NOT parse, store, or create AttendanceRecords**.
- **Data Safety**: No `AttendanceImport` tables or database modifications were added during this placeholder phase. The system requires an actual Mustard Seedtime sample before writing the importer. The selected File reference is cleared from React component state when the modal closes and is not persisted by HRISense.

---
