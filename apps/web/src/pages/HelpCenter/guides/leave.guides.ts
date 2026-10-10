import type { HelpGuideDefinition } from '../helpCenter.types';

const REVIEWED_OCT = '2026-10-09';
const REVIEWED = '2026-09-02';

/**
 * Leave Management.
 *
 * Reflects the two-stage workflow now in the system:
 *   Pending  → the employee has filed it
 *   For Review → a supervisor has endorsed it
 *   Approved / Rejected → HR Personnel decide
 *
 * Entitlement: Vacation, Sick, Bereavement, Paternity and Solo Parent leave follow
 * the Hospicio-confirmed entitlement by completed years of service (Paternity and
 * Solo Parent only for employees HR marked eligible). Every other leave type, and
 * any balance HR enters by hand, is HR's figure.
 */
export const LEAVE_GUIDES: HelpGuideDefinition[] = [
  {
    id: 'LEAVE_FILE_REQUEST',
    slug: 'file-leave-request',
    title: 'How to File a Leave Request',
    shortDescription: 'Ask for leave, choosing the type, the dates and the reason.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['file leave', 'apply leave', 'leave request', 'leave application form', 'sick leave', 'vacation', 'new request', 'leave without pay', 'offset', 'address during leave'],
    estimatedSteps: 4,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    isRecommended: true,
    lastReviewed: REVIEWED,
    appLink: { to: '/leave/new', label: 'New Leave Request' },
    content: {
      purpose: 'Submit a leave request so it can be endorsed and decided.',
      whenToUse: 'Whenever you need time off, as far in advance as you can.',
      prerequisites: ['You are signed in to HRISense.', 'You know the type of leave and the dates.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the request form',
          instruction: 'In the menu on the left, open **Leave Management** and select **New Request**.',
          expectedResult: 'The leave request form opens.',
          uiPath: 'Left menu -> Leave Management -> New Request',
        },
        {
          stepNumber: 2,
          title: 'Check your employee information',
          instruction: 'The **Employee Information** block shows your name, position, date employed and unit / department from your record — you do not type them. HR Personnel can file on behalf of another employee, or for several employees at once, under **Request For**.',
          explanation: 'If something in your employee information is wrong, ask HR to correct your record.',
          expectedResult: 'Your details are shown at the top of the form.',
          uiPath: 'New Request -> Request For',
        },
        {
          stepNumber: 3,
          title: 'Choose the type, dates and details',
          instruction: 'Choose the **Leave Type** — grouped as on Hospicio\'s paper form (VL, SL/EL, BL, Paternity / Maternity, Leave Without Pay, Others / Offset / Solo Parent). Set the **Start Date** and **End Date**; the **Total Number of Leave Applied** is worked out for you. Write the **Reason**, and add your **Address During Leave** and **Contact Number** (your mobile is filled in; change it if you will use another).',
          tip: 'Check the **Leave Record** — Total Available, Less: This Leave, Balance After Leave — before you submit. You can still file for more than you have; your head and HR decide, and may approve fewer days.',
          expectedResult: 'The form shows the type, dates, total days, reason and your leave record.',
          uiPath: 'New Request -> Leave Type, Start Date, End Date, Reason',
        },
        {
          stepNumber: 4,
          title: 'Submit',
          instruction: 'Submit the request.',
          expectedResult: 'A confirmation appears and the request is listed under Leave Requests as **Waiting for head** (or **Waiting for HR** if you have no assigned head).',
          uiPath: 'New Request -> submit',
        },
      ],
      whatHappensNext: 'Your head / supervisor reviews it first — they may endorse it, propose a change (other dates or fewer days), or decline it. HR Personnel then make the final decision and may approve it as requested, approve the proposed change, or approve other dates. Open the request to see its stage, what was proposed, and — if it changed — your original request beside the final approved leave. You are notified at each step.',
      troubleshooting: [
        {
          problem: 'The dates are refused.',
          solution: 'Check that the end date is not before the start date, and that the dates are not already covered by another request.',
        },
        {
          problem: 'My request still says Waiting for head after several days.',
          solution: 'Your head has not acted on it yet. Follow it up with them. You can also cancel it from the request while it is still waiting.',
        },
        {
          problem: 'I need leave for a day that is already my rest day.',
          solution: 'A rest day is already a non-working day, so no leave is needed for it. Ask HR if you are unsure how your week is set up.',
        },
      ],
      tips: [
        'File as early as you can — units need time to arrange cover.',
        'Leave is not the same as a rest day. Rest days come from your weekly schedule.',
      ],
      relatedGuideIds: ['LEAVE_VIEW_OWN', 'LEAVE_CANCEL_REQUEST', 'LEAVE_VIEW_BALANCE', 'LEAVE_VIEW_CALENDAR'],
    },
  },

  {
    id: 'LEAVE_VIEW_OWN',
    slug: 'view-my-leave-requests',
    title: 'How to Check Your Leave Requests',
    shortDescription: 'See where each of your requests has reached.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['my leave', 'leave status', 'pending', 'approved', 'rejected', 'endorsed'],
    estimatedSteps: 2,
    screenshotRecommended: false,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/leave/requests', label: 'Leave Requests' },
    content: {
      purpose: 'Follow a leave request from filing to decision.',
      whenToUse: 'After filing a request, or when you need to check a past one.',
      prerequisites: ['You are signed in to HRISense.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open Leave Requests',
          instruction: 'In the menu on the left, open **Leave Management** and select **Leave Requests**.',
          expectedResult: 'Your requests are listed with their type, dates and status.',
          uiPath: 'Left menu -> Leave Management -> Leave Requests',
        },
        {
          stepNumber: 2,
          title: 'Read the stage',
          instruction: 'Each request shows its stage in plain words: **Waiting for head** (or **Waiting for HR** if you have no head), **Endorsed — with HR**, **Change proposed — with HR**, **Approved**, **Approved with changes**, **Declined** or **Cancelled**. Select **View** to open the full request.',
          explanation: 'The request shows a stage tracker, your leave record for that type, any change your head proposed, the reason if it was declined, and its history.',
          expectedResult: 'You can see exactly where the request is and who has acted on it.',
          uiPath: 'Leave Requests -> My Requests -> View',
        },
      ],
      whatHappensNext: 'You are notified when the status changes. Approved leave appears on the leave calendar.',
      troubleshooting: [
        {
          problem: 'My request was declined and I do not know why.',
          solution: 'Open the request — the reason is shown with the decision.',
        },
        {
          problem: 'I cannot see a request I filed.',
          solution: 'Check any status filter on the page, then look again. Cancelled requests may be hidden by the default view.',
        },
      ],
      tips: ['The bell icon at the top right also tells you when a decision has been made.'],
      relatedGuideIds: ['LEAVE_FILE_REQUEST', 'LEAVE_CANCEL_REQUEST', 'NOTIFICATIONS_CENTER'],
    },
  },

  {
    id: 'LEAVE_CANCEL_REQUEST',
    slug: 'cancel-leave-request',
    title: 'How to Cancel a Leave Request',
    shortDescription: 'Withdraw a request you no longer need.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['cancel leave', 'withdraw request', 'no longer needed', 'cancel'],
    estimatedSteps: 2,
    screenshotRecommended: false,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/leave/requests', label: 'Leave Requests' },
    content: {
      purpose: 'Withdraw a leave request so it is no longer waiting for a decision.',
      whenToUse: 'When your plans change and you no longer need the leave.',
      prerequisites: ['You are signed in.', 'The request has not already been decided in a way that prevents cancelling.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the request',
          instruction: 'Go to **Leave Management** -> **Leave Requests** and select the request.',
          expectedResult: 'The request details open.',
          uiPath: 'Leave Requests -> request',
        },
        {
          stepNumber: 2,
          title: 'Cancel it',
          instruction: 'Select **Cancel request** and confirm. This is possible only while the request is still waiting for a decision.',
          explanation: 'Cancelling releases any days that were being held against your balance while the request was awaiting a decision.',
          expectedResult: 'The request shows as **Cancelled** and is no longer waiting on anyone.',
          uiPath: 'Request -> cancel',
        },
      ],
      whatHappensNext: 'The request stays in your list as cancelled, so the history is preserved.',
      troubleshooting: [
        {
          problem: 'There is no cancel action.',
          solution: 'The request may already be decided. Speak to HR Personnel if approved leave needs to be undone.',
        },
      ],
      tips: ['Cancel as soon as you know, so your supervisor is not reviewing something that is no longer needed.'],
      relatedGuideIds: ['LEAVE_VIEW_OWN', 'LEAVE_FILE_REQUEST'],
    },
  },

  {
    id: 'LEAVE_VIEW_BALANCE',
    slug: 'view-leave-balance',
    title: 'How to Read Your Leave Balances',
    shortDescription: 'Understand the total, used, pending and remaining figures.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['leave balance', 'leave credits', 'remaining leave', 'used leave', 'pending days'],
    estimatedSteps: 2,
    screenshotRecommended: false,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/profile', label: 'My Profile' },
    content: {
      purpose: 'See how much leave of each type is recorded for you.',
      whenToUse: 'Before filing a request, or when checking a figure with HR.',
      prerequisites: ['You are signed in.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open your leave balances',
          instruction: 'Open **My Profile** and select **Leave**. Your dashboard\'s **Your Leave Balances** panel shows the same available figures.',
          expectedResult: 'A table shows each leave type recorded for you, by year.',
          uiPath: 'My Profile -> Leave',
        },
        {
          stepNumber: 2,
          title: 'Read the columns',
          instruction: 'The columns are **Year**, **Leave type**, **Total**, **Source**, **Used**, **Pending**, **Forfeited** and **Available**. Above them, **Entitlement by completed years of service** shows your start date, your completed years and what each leave type gives you.',
          explanation: 'Pending is days held for requests that have been filed but not yet decided. Available is what is left once used, pending and forfeited days are taken off the total. Source says whether the total follows your completed years (Automatic) or was entered by HR.',
          info: 'Vacation: 0 days before your first completed year, 10 days from 1 completed year, 15 from 3. Sick: 7 and Bereavement: 5 from 1 completed year. Paternity and Solo Parent: 7 from 1 completed year, only if HR has marked you eligible. A year is completed on the anniversary of your start date.',
          expectedResult: 'You can see what is available for each leave type.',
          uiPath: 'Leave Balances table',
        },
      ],
      whatHappensNext: 'Filing a request moves days into Pending; a decision then moves them to Used or releases them.',
      troubleshooting: [
        {
          problem: 'No balances are listed.',
          solution: 'Automatic balances start after your first completed year of service. For other leave types, HR records the balance — contact HR Personnel.',
        },
        {
          problem: 'A figure does not match my own record.',
          solution: 'Raise it with HR Personnel — balances are maintained by HR.',
        },
      ],
      tips: ['Check your balance before filing, so you are not surprised by the decision.'],
      relatedGuideIds: ['LEAVE_MANAGE_BALANCES', 'LEAVE_FILE_REQUEST', 'EMPLOYEE_VIEW_OWN_PROFILE'],
    },
  },

  {
    id: 'LEAVE_MANAGE_BALANCES',
    slug: 'manage-leave-balances',
    title: 'How to Set an Employee\'s Leave Balances',
    shortDescription: 'Record or correct the leave credits an employee has for a year.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL'],
    keywords: ['leave balance', 'set credits', 'leave entitlement', 'adjust balance', 'forfeited'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    appLink: { to: '/employees', label: 'Employee Directory' },
    content: {
      purpose: 'Check the automatic entitlement, and record or correct the leave credits that are entered by HR.',
      whenToUse: 'When an employee joins, for leave types without an automatic entitlement, or when a correction is agreed.',
      prerequisites: [
        'You are signed in as HR Personnel.',
        'Vacation, Sick, Bereavement, Paternity and Solo Parent leave are calculated from completed years of service; you only enter other leave types or deliberate exceptions.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the employee\'s balances',
          instruction: 'Open the employee\'s 201 profile and select the **Leave Balances** tab.',
          expectedResult: 'The balances already recorded are listed by year and leave type.',
          uiPath: 'Employee profile -> Leave Balances',
        },
        {
          stepNumber: 2,
          title: 'Add or change a balance',
          instruction: 'Choose the **Year** and the **Leave type**, then enter the total and, if applicable, any forfeited days.',
          warning: 'A total you enter is marked as entered by HR and the automatic entitlement will not change it. To go back to the policy figure, use **Use policy** in the entitlement table. Used and pending days are maintained by HRISense from actual requests.',
          expectedResult: 'The form holds the figures you entered.',
          uiPath: 'Leave Balances -> add / edit',
        },
        {
          stepNumber: 3,
          title: 'Save',
          instruction: 'Save the balance.',
          expectedResult: 'The table shows the new figures, and the employee sees them on their own profile.',
          uiPath: 'Leave Balances -> save',
        },
      ],
      whatHappensNext: 'The employee\'s requests are measured against the recorded balance, and the remaining figure updates as requests are decided.',
      troubleshooting: [
        {
          problem: 'The remaining figure is not what I expected.',
          solution: 'Remaining is the total less used, pending and forfeited days. Check whether the employee has requests awaiting a decision.',
        },
        {
          problem: 'An employee has no balances at all.',
          solution: 'Automatic balances are created once the employee has a completed year of service (Paternity and Solo Parent only if marked eligible). Use **Update leave entitlements** on the Leave page to apply them to everyone now. Other leave types are added by HR.',
        },
        {
          problem: 'The policy figure and the balance differ.',
          solution: 'The balance was entered by HR, so it is kept. Select **Use policy** in the entitlement table if it should follow the completed-years entitlement instead.',
        },
      ],
      tips: ['Record balances per year, so the previous year\'s figures stay intact.'],
      relatedGuideIds: ['LEAVE_VIEW_BALANCE', 'LEAVE_APPROVE_REJECT'],
    },
  },

  {
    id: 'LEAVE_SUPERVISOR_ENDORSE',
    slug: 'endorse-leave-request',
    title: 'How to Endorse, Propose a Change to, or Decline a Team Member\'s Leave',
    shortDescription: 'Review your team\'s leave requests and recommend them to HR — as filed, or with a proposed change.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['SUPERVISOR'],
    keywords: ['endorse leave', 'supervisor leave', 'team leave', 'reject leave', 'decline leave', 'recommend', 'propose change', 'revise leave dates', 'head'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    isRecommended: true,
    lastReviewed: REVIEWED,
    appLink: { to: '/leave/requests', label: 'Leave Requests' },
    content: {
      purpose: 'Give your view on a team member\'s leave request before HR makes the final decision.',
      whenToUse: 'When one of your direct reports files leave.',
      prerequisites: [
        'You are signed in as a Supervisor.',
        'The employee is recorded as reporting to you.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Open Leave Requests',
          instruction: 'In the menu on the left, open **Leave Management** and select **Leave Requests**.',
          expectedResult: 'Requests from your team are listed, with **Pending** ones waiting on you.',
          uiPath: 'Left menu -> Leave Management -> Leave Requests',
        },
        {
          stepNumber: 2,
          title: 'Review the request',
          instruction: 'Select **View** on a request. One screen shows the employee (position, unit, date employed, years of service), the leave type, dates, total days, reason, address and contact during leave, and the **Leave Record** — total available, less this leave, balance after.',
          expectedResult: 'The full request opens in a panel.',
          uiPath: 'Leave Requests -> request',
        },
        {
          stepNumber: 3,
          title: 'Endorse, propose a change, or decline',
          instruction: 'Select **Endorse to HR** to recommend it as filed (a note to HR is optional). If other dates or fewer days would work better, select **Propose a change**, set the **From** and **To**, give the reason, and select **Endorse with this change**. Select **Decline** only if it cannot be supported, and give the reason.',
          explanation: 'Neither endorsing nor proposing approves the leave — HR decides. A proposal does not change the employee\'s request: HR sees both and chooses. The employee is told what you proposed.',
          warning: 'Declining ends the request, so the reason you give is what the employee will read. Most disagreements are better handled with **Propose a change**.',
          expectedResult: 'The status becomes **Endorsed — with HR** or **Change proposed — with HR**, or **Declined** with your reason.',
          uiPath: 'Request panel -> Endorse to HR / Propose a change / Decline',
        },
      ],
      whatHappensNext: 'Endorsed requests go to HR Personnel. The employee is notified of each change.',
      troubleshooting: [
        {
          problem: 'A team member says they filed leave but I cannot see it.',
          solution: 'You only see requests from staff recorded as reporting to you. Ask HR Personnel to check the supervisor assignment on their record.',
        },
        {
          problem: 'I endorsed by mistake.',
          solution: 'Contact HR Personnel before they decide — they can still reject the request.',
        },
      ],
      tips: ['Endorse promptly. A request left pending is waiting on you, not on HR.'],
      relatedGuideIds: ['LEAVE_VIEW_CALENDAR', 'LEAVE_VIEW_OWN', 'DASHBOARD_VIEW_SUPERVISOR'],
    },
  },

  {
    id: 'LEAVE_APPROVE_REJECT',
    slug: 'approve-reject-leave',
    title: 'How to Approve, Revise or Decline a Leave Request',
    shortDescription: 'Make the final decision on a leave request as HR Personnel — as requested, as the head proposed, or with other dates.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL'],
    keywords: ['approve leave', 'reject leave', 'decline leave', 'leave decision', 'hr approval', 'for review', 'revised dates', 'proposed change', 'original request'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    isRecommended: true,
    lastReviewed: REVIEWED,
    appLink: { to: '/leave/requests', label: 'Leave Requests' },
    content: {
      purpose: 'Decide leave requests, so employees and units know where they stand.',
      whenToUse: 'When requests are waiting, particularly those endorsed by a supervisor.',
      prerequisites: ['You are signed in as HR Personnel.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open Leave Requests',
          instruction: 'In the menu on the left, open **Leave Management** and select **Leave Requests**. Look for requests marked **Endorsed — with HR** or **Change proposed — with HR**.',
          explanation: 'You can also decide a request that is still Pending, but usually the supervisor endorses it first.',
          expectedResult: 'Requests are listed with their status.',
          uiPath: 'Left menu -> Leave Management -> Leave Requests',
        },
        {
          stepNumber: 2,
          title: 'Review it',
          instruction: 'Select **View**. One screen shows the employee and their years of service, the request, the head\'s note and any **change proposed** by the head, the **Leave Record** (including the balance if the proposal is approved), and the history.',
          expectedResult: 'The full request opens.',
          uiPath: 'Leave Requests -> request',
        },
        {
          stepNumber: 3,
          title: 'Decide',
          instruction: 'Select **Approve** (or **Approve as requested**) to grant what was filed; **Approve proposed change** to grant the head\'s dates; or **Approve other dates** to set your own From / To with a reason. Select **Decline** and give the reason if it cannot be granted.',
          explanation: 'When the approved leave differs, the employee\'s original request is kept and shown beside the final approved leave, with the reason. The balance is charged the final days, never the original ones.',
          warning: 'The decision is final in HRISense and the employee is notified.',
          expectedResult: 'The request shows as **Approved**, **Approved with changes** or **Declined**, and the employee\'s balance is updated.',
          uiPath: 'Request panel -> Approve / Approve proposed change / Approve other dates / Decline',
        },
      ],
      whatHappensNext: 'Approved leave appears on the leave calendar and in the leave report. The employee is notified either way.',
      troubleshooting: [
        {
          problem: 'The employee has no balance for that leave type.',
          solution: 'Record the balance on their Leave Balances tab first, then decide the request.',
        },
        {
          problem: 'I approved the wrong request.',
          solution: 'Speak to the employee and their supervisor. Corrections should be recorded openly rather than quietly reversed.',
        },
      ],
      tips: ['Check the leave calendar before approving, so a unit is not left short.'],
      relatedGuideIds: ['LEAVE_MANAGE_BALANCES', 'LEAVE_VIEW_CALENDAR', 'REPORTS_GENERATE'],
    },
  },

  {
    id: 'LEAVE_VIEW_CALENDAR',
    slug: 'view-leave-calendar',
    title: 'How to Use the Leave Calendar',
    shortDescription: 'See who is on leave on which dates before deciding or planning.',
    module: 'Leave Management',
    category: 'LEAVE',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['leave calendar', 'who is on leave', 'coverage', 'schedule leave', 'team calendar'],
    estimatedSteps: 2,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    appLink: { to: '/leave/calendar', label: 'Leave Calendar' },
    content: {
      purpose: 'See leave laid out across the month rather than as a list.',
      whenToUse: 'Before approving leave, before filing your own, or when planning cover.',
      prerequisites: ['You are signed in to HRISense.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the calendar',
          instruction: 'In the menu on the left, open **Leave Management** and select **Leave Calendar**.',
          explanation: 'What you see depends on your role: HR Personnel see the whole hospital, supervisors see their team, and employees see their own leave.',
          expectedResult: 'The month opens with leave marked on the relevant dates.',
          uiPath: 'Left menu -> Leave Management -> Leave Calendar',
        },
        {
          stepNumber: 2,
          title: 'Read a date',
          instruction: 'Select a date to see who is on leave that day and what type it is.',
          expectedResult: 'The people on leave that day are listed.',
          uiPath: 'Leave Calendar -> date',
        },
      ],
      whatHappensNext: 'You can move straight to filing a request for dates you have identified as free.',
      troubleshooting: [
        {
          problem: 'Approved leave is not shown.',
          solution: 'Check you are looking at the right month, and that any filters are cleared.',
        },
      ],
      tips: ['Rest days are not shown here — they belong to the weekly schedule, not to leave.'],
      relatedGuideIds: ['LEAVE_FILE_REQUEST', 'LEAVE_APPROVE_REJECT'],
    },
  },
];
