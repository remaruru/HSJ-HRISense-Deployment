# Leave Calendar UI Audit

This document describes the actual implemented behavior for the Leave Calendar component (`CalendarGrid.tsx`) and the Leave Calendar page (`LeaveCalendarPage.tsx`).

## Calendar Architecture (`CalendarGrid.tsx`)

- **Grid Layout**: Custom implementation using CSS Grid (`grid-cols-7`).
- **Cell Count**: Fixed to 42 cells (6 full weeks). This supports all possible month starts (e.g., a 31-day month starting on a Saturday correctly flows into the 6th row).
- **Navigation**: "Previous Month", "Today", and "Next Month" controls. Clicking "Today" jumps to the current month.
- **Indicators**: The current date (today) is highlighted with a circular filled indicator.
- **Leading/Trailing Days**: Days from the previous and next month are rendered with muted styling (`text-muted-foreground`) to maintain the 42-cell structure without visual gaps.

## Event Rendering

- **Approved Events**: Rendered with a solid primary background chip and a green indicator dot.
- **Pending Events**: Rendered with an amber warning background chip and an amber indicator dot.
- **Excluded Statuses**: `REJECTED` and `CANCELLED` leave requests are explicitly excluded from the calendar view.
- **Multi-Day Leave**: Handled by a pure date-range comparison (`isDateInRange`). A single request spanning multiple days (e.g., Aug 14 to Aug 16) is rendered individually on every applicable day cell.
- **Event Overflow (+N more)**: A maximum of 2 events are shown per day cell. If a day contains more than 2 events, the remaining events are hidden behind a `+X more` button. Clicking the cell or the `+X more` button opens the Day Detail drawer.

## Interactions & Layouts

- **Day Detail Drawer**: Clicking any date opens a right-side drawer showing all events for that specific date. 
  - **Employee/Self**: Sees full details of own leave.
  - **Supervisor Team**: Sees employee name, dates, leave type, and status, but reason/notes are hidden with the text: *"Full details are accessible to HR only."*
  - **HR (FULL)**: Sees full details, employee avatars, etc.
- **Upcoming Leave Side Panel**: Displays up to 6 `APPROVED` leave events starting in the next 30 days. Uses the same privacy scoping rules as the main calendar.
- **Accessibility**: Calendar cells are focusable (`tabIndex={0}`) and respond to keyboard events (`Enter` or `Space` opens the Day Detail drawer).
- **Light/Dark Mode**: The calendar dynamically respects the system's active theme, using CSS variables (`bg-surface`, `border-border`, `bg-muted`) for seamless switching.
- **Loading, Error, and Empty States**: Handled natively within the grid component without breaking the layout. Loading shows a skeleton pulse over the grid; error displays an explicit `AlertCircle` warning; empty months just show empty cells.
- **Mobile vs Desktop Behavior**: On large screens (`xl:grid-cols-[1fr_280px]`), the calendar and the upcoming leave sidebar sit side-by-side. On smaller screens, the sidebar drops below the calendar.
- **Date-Only Timezone Handling**: All dates are processed locally without UTC coercion (`parseLocalDate` mapping `'YYYY-MM-DD'` directly to local year, month, day), avoiding accidental timezone shifts (e.g., Aug 14 rendering as Aug 13).

## HR Organization Calendar (Filters)

Available exclusively to the `FULL` permission tier on the "Organization Calendar" tab:
- **Unit Filter**: Select from available organizational units.
- **Department Filter**: Automatically updates to show departments belonging to the selected unit. Reset when unit changes.
- **Employee Filter**: Select specific employees. Dynamically filtered by the active unit and department. Reset when unit or department changes.
- **Leave Type Filter**: Filters by leave category (e.g., SICK, VACATION).
- **Status Filter**: Toggle between "Approved + Pending", "Approved Only", and "Pending Only".

## Known Limitations

- Leave events are rendered as individual chips per day cell rather than continuous multi-cell spanning bars.
- The calendar requires a full dataset reload when switching months; client-side caching of adjacent months is not yet implemented.

## Manual QA Pending

- Ensure the 42-cell layout never cuts off the 30th/31st on months starting on Saturday.
- Verify cascading filter reset logic (changing Unit correctly unselects a previously selected Employee).
- Test mobile view tap targets for the `+X more` button.
- Verify that `REJECTED` and `CANCELLED` statuses are never rendered.
