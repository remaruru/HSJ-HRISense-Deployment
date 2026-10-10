import type { HelpGuideDefinition } from './helpCenter.types';

/**
 * Development-only test fixture to verify the complete READY guide reader UX
 * without polluting the production registry or inventing real unverified procedures.
 */
export const DEV_READER_FIXTURE: HelpGuideDefinition = {
  id: 'DEV_GUIDE_READER_SAMPLE',
  slug: 'preview-guide-reader',
  title: 'How to Use the HRISense Guide Reader (Sample Guide)',
  shortDescription: 'Demonstration of the accessible step-by-step guide layout, visual instructions, screenshot viewer, and troubleshooting tools.',
  module: 'Help Center',
  category: 'AUTH',
  roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
  keywords: ['sample', 'preview', 'guide reader', 'demonstration', 'tutorial'],
  estimatedSteps: 3,
  screenshotRecommended: true,
  sensitiveScreenshot: false,
  contentStatus: 'READY',
  lastReviewed: '2026-08-26',
  content: {
    purpose: 'This sample guide demonstrates how instructions, step numbers, expected results, tips, warnings, and screenshot enlargement work in the HRISense Help Center.',
    whenToUse: 'Use this guide to explore the reader layout and verify print styling, screenshot enlargement, and accordion troubleshooting.',
    prerequisites: [
      'You are signed in to your HRISense account with valid credentials.',
      'You are accessing HRISense from a supported desktop, tablet, or mobile browser.',
      'You have opened the Help Center from the sidebar navigation menu.',
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Open the Desired Hospital Module',
        instruction: 'From the main left sidebar navigation, select **Help Center** or the corresponding module you wish to access.',
        explanation: 'The sidebar remains accessible on the left of your screen. On mobile devices, tap the menu icon at the top-left to expand the sidebar.',
        screenshot: {
          src: '/assets/help/sample-sidebar.png',
          alt: 'Sidebar navigation highlighting Help Center',
          caption: 'The Help Center navigation link is located under the Administration section in the left sidebar.',
          sensitive: false,
        },
        expectedResult: 'The Help Center homepage opens, displaying the main search bar, category cards, and common tasks.',
      },
      {
        stepNumber: 2,
        title: 'Search or Select a Feature Guide',
        instruction: 'Type your task into the **Search for a feature or task...** input, or click any **Category Card** to view matching topics.',
        tip: 'You can use common everyday keywords like "leave", "attendance", or "password" to find relevant guides quickly.',
        expectedResult: 'The search results list updates instantly to show all verified step-by-step guides available to your account role.',
      },
      {
        stepNumber: 3,
        title: 'Follow the Numbered Action Steps',
        instruction: 'Scroll down through each numbered step in order. If a screenshot is provided, click **Click to enlarge** to inspect button locations in full size.',
        warning: 'Always double-check all required form fields before clicking the final **Submit** or **Save** button in any hospital form.',
        info: 'You can use the **Print Guide** button at the top-right to generate a clean, paper-friendly summary of any procedure.',
        expectedResult: 'You reach the end of the procedure and achieve the desired task successfully.',
      },
    ],
    whatHappensNext: 'Your requested action is completed immediately in HRISense, and the relevant records or schedules are updated for your department.',
    troubleshooting: [
      {
        problem: 'I cannot find the button described in the guide.',
        solution: 'Check if you are viewing the correct tab or section. Some management actions require specific permissions or subordinate staff assignments.',
        note: 'If a feature remains unavailable, consult HR Personnel to verify your role assignment.',
      },
      {
        problem: 'The screenshot does not match my current screen.',
        solution: 'Make sure your browser window is expanded. On smaller screens or mobile phones, certain tables and sidebars collapse into menus.',
      },
    ],
    tips: [
      'You can print any guide for offline reference by clicking the Print Guide button.',
      'Press the Escape key at any time to close an enlarged screenshot preview.',
    ],
    relatedGuideIds: ['AUTH_LOGIN', 'AUTH_CHANGE_PASSWORD', 'LEAVE_FILE_REQUEST'],
  },
};
