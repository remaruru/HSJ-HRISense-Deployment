import type { HelpGuideDefinition } from '../helpCenter.types';

const REVIEWED_OCT = '2026-10-09';
const REVIEWED = '2026-09-02';

/**
 * Dashboard guides.
 *
 * Each tier lands on a different dashboard, so each has its own guide rather
 * than one guide pretending the three screens are the same.
 */
export const DASHBOARD_GUIDES: HelpGuideDefinition[] = [
  {
    id: 'DASHBOARD_VIEW_HR',
    slug: 'navigating-hr-dashboard',
    title: 'Navigating the HR Dashboard',
    shortDescription: 'Headcount, compliance follow-ups, leave awaiting your decision, and the attendance trend.',
    module: 'Dashboard',
    category: 'DASHBOARD',
    roles: ['FULL'],
    keywords: ['dashboard', 'hr dashboard', 'home', 'overview', 'headcount', 'attendance trend', 'awaiting hr decision', 'recent activity'],
    estimatedSteps: 4,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/dashboard', label: 'Dashboard' },
    content: {
      purpose: 'See at a glance what needs HR attention today.',
      whenToUse: 'At the start of the day, or whenever you return to HRISense.',
      prerequisites: ['You are signed in as HR Personnel (HR Officer, HR staff or Sister).'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the dashboard',
          instruction: 'Select **Dashboard** at the top of the menu. It is also the page you land on after signing in. Current announcements are shown first.',
          expectedResult: 'The welcome panel shows your summary cards.',
          uiPath: 'Left menu -> Dashboard',
        },
        {
          stepNumber: 2,
          title: 'Read the summary cards',
          instruction: 'Check **Total Employees**, **Compliance: Action Required** (missing, expired or expiring records), **Compliance: Needs Review** (submitted records waiting for HR) and **Awaiting HR Decision** (leave requests waiting for you).',
          expectedResult: 'You know which module needs you first.',
          uiPath: 'Dashboard -> summary cards',
        },
        {
          stepNumber: 3,
          title: 'Check the attendance trend',
          instruction: "The **Attendance Trend** chart shows the monthly attendance rate from imported attendance records. Select **View breakdown** to see each month's counts.",
          info: 'A day with no imported record is never counted as an absence. Months with no imported attendance show no rate instead of zero.',
          expectedResult: "You can see how each month's rate was worked out.",
          uiPath: 'Dashboard -> Attendance Trend -> View breakdown',
        },
        {
          stepNumber: 4,
          title: 'Use your calendar and activity',
          instruction: 'Below the chart is **My Calendar** (holidays, leave, trainings, interviews, deadlines, birthdays and notes). On the right, **Recent Activity** lists what you did in HRISense.',
          expectedResult: 'You can plan the day and retrace your own recent actions.',
          uiPath: 'Dashboard -> My Calendar / Recent Activity',
        },
      ],
      whatHappensNext: 'Open any module from the menu, or use **Quick actions** (the ⚡ button in the top bar) for common HR tasks.',
      troubleshooting: [
        {
          problem: 'The attendance chart says "No attendance data yet".',
          solution: 'No attendance has been imported. The chart appears once attendance records are imported from the biometric export.',
        },
        {
          problem: 'There is no To Do list on my dashboard.',
          solution: 'That is intentional for HR: you work from the module pages, such as Leave Requests and Compliance.',
        },
      ],
      tips: ['Selecting the HRISense logo at the top left brings you back to the dashboard from anywhere.'],
      relatedGuideIds: ['DASHBOARD_MY_CALENDAR', 'LEAVE_APPROVE_REJECT', 'COMPLIANCE_NEEDS_ATTENTION', 'ATTENDANCE_DAILY_MONITORING'],
    },
  },

  {
    id: 'DASHBOARD_VIEW_SUPERVISOR',
    slug: 'navigating-supervisor-dashboard',
    title: 'Navigating the Supervisor Dashboard',
    shortDescription: 'Your team count, team compliance, who is in today, and what is waiting on you.',
    module: 'Dashboard',
    category: 'DASHBOARD',
    roles: ['SUPERVISOR'],
    keywords: ['dashboard', 'supervisor dashboard', 'home', 'team', 'team presence', 'to do', 'late today', 'my team'],
    estimatedSteps: 4,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/dashboard', label: 'Dashboard' },
    content: {
      purpose: 'Check on the staff who report to you and pick up what is waiting for your action.',
      whenToUse: 'At the start of your shift.',
      prerequisites: ['You are signed in as a Head, Supervisor or Coordinator.', 'HR has recorded you as the immediate supervisor of your staff.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the dashboard',
          instruction: 'Select **Dashboard** in the menu. Current announcements are shown first.',
          expectedResult: 'The welcome panel shows your team cards.',
          uiPath: 'Left menu -> Dashboard',
        },
        {
          stepNumber: 2,
          title: 'Read the team cards',
          instruction: 'Check **Team Count** (your direct reports), **Team Compliance: Action Required**, **Team Compliance: Needs Review** and **Late Today**.',
          explanation: 'Only staff whose immediate supervisor is you are counted — not everyone in your unit.',
          expectedResult: "You see your team's standing for today.",
          uiPath: 'Dashboard -> team cards',
        },
        {
          stepNumber: 3,
          title: 'See who is in',
          instruction: 'Read **Team Presence Today** and **Late & Tardiness Log Monitoring**. Select **View All Records** to open Daily Monitoring.',
          info: 'These show the attendance that has been imported. A team member with no imported record is not shown as absent.',
          expectedResult: 'You know who has an attendance record today.',
          uiPath: 'Dashboard -> Team Presence Today',
        },
        {
          stepNumber: 4,
          title: 'Work through your To Do list',
          instruction: 'On the right, **To Do** lists what is waiting on you — for example leave to endorse or an evaluation to complete. Select an item to open it. **Hide** removes an item from the list; **Show hidden** brings hidden items back.',
          expectedResult: 'Each task opens the page where you complete it.',
          uiPath: 'Dashboard -> To Do',
        },
      ],
      whatHappensNext: 'Leave you endorse goes on to HR for the final decision.',
      troubleshooting: [
        {
          problem: 'My team looks empty or someone is missing.',
          solution: "Your team is the staff whose immediate supervisor is you. Ask HR to check the supervisor recorded on that person's profile.",
        },
      ],
      tips: ['Use **Quick actions** (⚡ in the top bar) to jump to My Team, Leave Requests or Team Attendance.'],
      relatedGuideIds: ['EMPLOYEE_MY_TEAM', 'LEAVE_SUPERVISOR_ENDORSE', 'DASHBOARD_MY_CALENDAR', 'ATTENDANCE_DAILY_MONITORING'],
    },
  },

  {
    id: 'DASHBOARD_VIEW_EMPLOYEE',
    slug: 'navigating-employee-dashboard',
    title: 'Navigating Your Dashboard',
    shortDescription: 'Your leave balances, weekly schedule, requirements and the things waiting on you.',
    module: 'Dashboard',
    category: 'DASHBOARD',
    roles: ['STANDARD'],
    keywords: ['dashboard', 'home', 'my dashboard', 'leave balance', 'my schedule', 'to do', 'requirements'],
    estimatedSteps: 4,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/dashboard', label: 'Dashboard' },
    content: {
      purpose: 'See your own work information in one place.',
      whenToUse: 'Whenever you sign in.',
      prerequisites: ['You are signed in to HRISense.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the dashboard',
          instruction: 'Select **Dashboard** in the menu. It is where you land after signing in. Announcements for you are shown first.',
          expectedResult: 'The welcome panel shows your requirement cards.',
          uiPath: 'Left menu -> Dashboard',
        },
        {
          stepNumber: 2,
          title: 'Check your requirements',
          instruction: 'Read **My Requirements: Action Required** (missing or expired), **Expiring Soon** and **Awaiting HR Review** (submitted, not yet reviewed).',
          expectedResult: 'You know whether any requirement needs your attention.',
          uiPath: 'Dashboard -> requirement cards',
        },
        {
          stepNumber: 3,
          title: 'Check your leave and your week',
          instruction: "**Your Leave Balances** shows the days available to file for each leave type; select **View breakdown** to see allotted, used, pending and forfeited days. **Weekly Work Schedule** shows this week's shifts.",
          expectedResult: 'You know how many days you can file and when you work.',
          uiPath: 'Dashboard -> Your Leave Balances / Weekly Work Schedule',
        },
        {
          stepNumber: 4,
          title: 'Use your To Do list and calendar',
          instruction: '**To Do** on the right lists what is waiting on you, such as an evaluation to complete. **My Calendar** shows holidays, your leave, trainings, deadlines and your notes.',
          expectedResult: 'Selecting a To Do item opens the page where you complete it.',
          uiPath: 'Dashboard -> To Do / My Calendar',
        },
      ],
      whatHappensNext: 'You can file leave, open **My Profile** or check your attendance from the menu or from **Quick actions** (⚡ in the top bar).',
      troubleshooting: [
        {
          problem: 'My schedule panel is empty.',
          solution: 'A weekly schedule has not been set for you yet. Ask your supervisor or HR.',
        },
        {
          problem: 'My leave balance looks wrong.',
          solution: "Vacation, Sick, Bereavement, Paternity and Solo Parent balances follow your completed years of service; other balances are entered by HR. Open **View breakdown**, or your profile's Leave tab, to see how each figure was reached, and contact HR if it still looks wrong.",
        },
      ],
      tips: ['The bell at the top right shows notifications addressed to you.'],
      relatedGuideIds: ['DASHBOARD_MY_CALENDAR', 'LEAVE_FILE_REQUEST', 'LEAVE_VIEW_BALANCE', 'EMPLOYEE_VIEW_OWN_PROFILE'],
    },
  },

  {
    id: 'DASHBOARD_MY_CALENDAR',
    slug: 'my-calendar-and-notes',
    title: 'How to Use My Calendar and Notes',
    shortDescription: 'See holidays, leave, trainings and deadlines on your dashboard calendar, and keep your own notes.',
    module: 'Dashboard',
    category: 'DASHBOARD',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['calendar', 'my calendar', 'note', 'notes', 'add note', 'reminder', 'recent activity', 'deadline'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/dashboard', label: 'Dashboard' },
    content: {
      purpose: 'Plan your days from one calendar and keep short notes for yourself.',
      whenToUse: 'When you want to see what is coming up, or jot down a reminder for a date.',
      prerequisites: ['You are signed in to HRISense.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open My Calendar',
          instruction: 'On your **Dashboard**, scroll to **My Calendar**. Switch between **Day**, **Week** and **Month**, and use **Show:** to choose which kinds of entries appear.',
          explanation: "It combines approved holidays, leave, trainings you are part of, deadlines, birthdays (HR: everyone's; supervisors: their team's), interviews (HR) and notes — only what you are allowed to see.",
          expectedResult: 'The calendar shows the entries you chose.',
          uiPath: 'Dashboard -> My Calendar',
        },
        {
          stepNumber: 2,
          title: 'Add a note',
          instruction: 'Pick a date, type a title (and optional details), and select **Add Note**.',
          explanation: 'A note you add is private: it is marked **Only you**.',
          expectedResult: 'The note appears on that date.',
          uiPath: 'My Calendar -> Add Note',
        },
        {
          stepNumber: 3,
          title: 'Mark it done, edit or delete it',
          instruction: 'Tick a note to mark it done (untick to reopen). Use the edit button and **Save** to change it, or delete it.',
          expectedResult: 'Done notes are crossed out; overdue ones are flagged.',
          uiPath: 'My Calendar -> note',
        },
      ],
      whatHappensNext: '**Recent Activity**, on the right of the dashboard, lists what you did in HRISense, newest first. Only you see it; use **Show activity as of a date** to look further back.',
      troubleshooting: [
        {
          problem: 'I cannot edit a note someone posted to me.',
          solution: 'Only the person who wrote a note can change or remove it.',
        },
      ],
      tips: ['Your private notes are never shown to HR or anyone else.'],
      relatedGuideIds: ['DASHBOARD_VIEW_EMPLOYEE', 'ATTENDANCE_HOLIDAY_CALENDAR', 'LEAVE_VIEW_CALENDAR'],
    },
  },

  {
    id: 'DASHBOARD_POST_NOTE',
    slug: 'post-calendar-note',
    title: 'How to Post a Calendar Note to Employees (HR)',
    shortDescription: 'Put a note on everyone\'s calendar, or on selected employees\' calendars, with a notification.',
    module: 'Dashboard',
    category: 'DASHBOARD',
    roles: ['FULL'],
    keywords: ['post note', 'calendar note', 'notify employees', 'post to employees', 'reminder to staff'],
    estimatedSteps: 2,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/dashboard', label: 'Dashboard' },
    content: {
      purpose: 'Remind staff of a date — for example a fire drill — on their own calendars.',
      prerequisites: ['You are signed in as HR Personnel.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open Post to employees',
          instruction: 'On your dashboard, in **My Calendar**, select **Post to employees**.',
          expectedResult: 'The "Post a note to employees" window opens.',
          uiPath: 'Dashboard -> My Calendar -> Post to employees',
        },
        {
          stepNumber: 2,
          title: 'Choose who sees it and post',
          instruction: 'Choose **All employees** or **Selected employees** (search and pick them), enter the date, title and optional details, and post it.',
          expectedResult: 'The note shows as posted to everyone or to the people you picked, and each recipient gets a notification.',
          uiPath: 'Post a note to employees -> post',
        },
      ],
      whatHappensNext: 'Only you can edit or remove the note. Removing it takes it off everyone\'s calendar.',
      troubleshooting: [
        {
          problem: 'It says to choose at least one employee.',
          solution: 'With **Selected employees**, pick at least one person.',
        },
      ],
      tips: ['For a formal notice with read tracking, use Announcements instead.'],
      relatedGuideIds: ['DASHBOARD_MY_CALENDAR', 'ANNOUNCEMENTS_CREATE_PUBLISH'],
    },
  },
];
