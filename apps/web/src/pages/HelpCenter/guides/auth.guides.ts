import type { HelpGuideDefinition } from '../helpCenter.types';

const REVIEWED_OCT = '2026-10-09';
const REVIEWED = '2026-09-02';

/**
 * Getting Started & Security.
 *
 * Written against the current sign-in flow: email + password, an optional
 * "Keep me signed in" choice, a forced password change on first sign-in, and
 * self-service password reset by emailed link.
 */
export const AUTH_GUIDES: HelpGuideDefinition[] = [
  {
    id: 'AUTH_LOGIN',
    slug: 'sign-in',
    title: 'How to Sign In to HRISense',
    shortDescription: 'Open HRISense and sign in with your email and password.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['sign in', 'log in', 'login', 'password', 'credentials', 'access', 'portal', 'account'],
    estimatedSteps: 4,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    isRecommended: true,
    lastReviewed: REVIEWED_OCT,
    content: {
      purpose: 'Open your HRISense account using the email address and password HR gave you.',
      whenToUse: 'At the start of your shift, or any time you need to open HRISense on a hospital computer or your own device.',
      prerequisites: [
        'HR has created your HRISense account and given you a temporary password.',
        'Your computer or phone can reach the HRISense address used by the hospital.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the sign-in page',
          instruction: 'Open your web browser and go to the HRISense address. If you try to open any other HRISense page while signed out, you are taken to the sign-in page automatically.',
          expectedResult: 'The Sign in to HRISense screen appears, with an Email box and a Password box.',
          uiPath: 'Web browser -> HRISense address',
        },
        {
          stepNumber: 2,
          title: 'Type your email and password',
          instruction: 'Type your personal email — the one HR recorded as your login — in **Personal email**, then type your password in **Password**.',
          tip: 'Check that Caps Lock is off before typing your password.',
          expectedResult: 'Both boxes are filled in.',
          uiPath: 'Sign-in card -> Email and Password',
        },
        {
          stepNumber: 3,
          title: 'Decide whether to stay signed in',
          instruction: 'Tick **Keep me signed in** only if this is your own device. Leave it unticked on a shared hospital computer.',
          warning: 'On a shared computer, leave this unticked. Otherwise the next person to open the browser could reach your account.',
          expectedResult: 'The tick box shows your choice.',
          uiPath: 'Sign-in card -> Keep me signed in',
        },
        {
          stepNumber: 4,
          title: 'Select Sign In',
          instruction: 'Tick **I\'m not a robot** if it is shown, then select **Sign In to HRISense**. Until the box is ticked, the button reads **Please finish the CAPTCHA** and cannot be selected.',
          expectedResult: 'Your dashboard opens. If this is your first sign-in, you are asked to set your own password first.',
          uiPath: 'Sign-in card -> Sign In to HRISense',
          tip: 'If **Continue with Google** is shown, you can use it instead of steps 2 and 4 — but only with the Google account whose email is the same personal email HR registered. It never creates an account, and a temporary password must still be changed first.',
        },
      ],
      whatHappensNext: 'You land on the dashboard for your role, and the menu on the left shows the parts of HRISense you may use.',
      troubleshooting: [
        {
          problem: 'It says "Invalid email or password".',
          solution: 'Check the spelling of your email and make sure Caps Lock is off. If you still cannot get in, select "Forgot password?" on the sign-in page.',
        },
        {
          problem: 'It takes me to a Change Password screen instead of the dashboard.',
          solution: 'That is normal for a new or reset account. Set your own password and you will continue straight to the dashboard.',
        },
        {
          problem: 'The button says "Please finish the CAPTCHA".',
          solution: 'Tick **I\'m not a robot** above the button (and complete the picture check if Google shows one). The box is needed for every sign-in, and again after each failed attempt.',
        },
        {
          problem: 'The button says "Try again in …" after a wrong password.',
          solution: 'You get 3 tries. After the third wrong password in a row, each further one makes this browser wait before the next try: 15 seconds, then 30 seconds, then 1 minute, then 15 minutes for every further wrong password. Your account itself is never locked by wrong passwords, so you can still sign in from another device. A successful sign-in gives you your 3 tries back; otherwise wrong passwords are forgotten after an hour without failures.',
        },
        {
          problem: 'It says my account is locked.',
          solution: 'HR Personnel locked the account on purpose (for example for a security concern). Ask them to unlock it.',
        },
        {
          problem: 'It says my account is inactive.',
          solution: 'Ask HR Personnel to check your account. Deactivated accounts cannot sign in until HR reactivates them.',
        },
        {
          problem: 'Continue with Google says no HRISense account is registered with this Google email.',
          solution: 'Google sign-in only works when your Google email is exactly the personal email HR recorded for you. Sign in with your email and password, or ask HR to check which email is on your account. Do not keep trying other Google accounts: repeated attempts with unregistered emails block Google sign-in on your network for a while.',
        },
        {
          problem: 'It says Google sign-in is blocked on this network.',
          solution: 'Someone on your network tried Google sign-in with unregistered emails several times. Sign in with your email and password — that still works — and Google sign-in comes back on its own after about 30 minutes.',
        },
        {
          problem: 'Nothing happens when I select Continue with Google.',
          solution: 'Your browser may be blocking pop-ups. Allow pop-ups for the HRISense address and try again, or sign in with your email and password.',
        },
      ],
      tips: [
        'Always sign out when you leave a shared hospital computer.',
        'Save the HRISense address as a browser bookmark so it is quick to open.',
      ],
      relatedGuideIds: ['AUTH_GOOGLE_SIGN_IN', 'AUTH_REMEMBER_ME', 'AUTH_FIRST_TIME_PASSWORD', 'AUTH_FORGOT_PASSWORD', 'AUTH_LOGOUT'],
    },
  },

  {
    id: 'AUTH_REMEMBER_ME',
    slug: 'keep-me-signed-in',
    title: 'Using "Keep Me Signed In"',
    shortDescription: 'What the Keep me signed in tick box does, and when it is safe to use.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['remember me', 'keep me signed in', 'stay signed in', 'session', 'shared computer', 'security'],
    estimatedSteps: 2,
    screenshotRecommended: false,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    content: {
      purpose: 'Decide whether HRISense should keep you signed in after you close the browser.',
      whenToUse: 'Every time you sign in. The choice matters most on shared hospital workstations.',
      prerequisites: ['You are on the HRISense sign-in page.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Find the tick box',
          instruction: 'Underneath the Password box you will see **Keep me signed in**.',
          explanation: 'When ticked, your session stays open after you close the browser. When unticked, closing the browser ends your session.',
          expectedResult: 'You can see the tick box before you select Sign In.',
          uiPath: 'Sign-in card -> Keep me signed in',
        },
        {
          stepNumber: 2,
          title: 'Choose based on the device',
          instruction: 'Tick it on a device only you use. Leave it unticked on any shared computer, including nurse stations and office workstations used by several staff.',
          warning: 'Never tick this on a shared computer. Anyone who opens the browser afterwards would be inside your account, including your own records.',
          expectedResult: 'HRISense remembers your choice for the next time you sign in on this device.',
          uiPath: 'Sign-in card -> Keep me signed in',
        },
      ],
      whatHappensNext: 'If you ticked it, you will usually go straight to your dashboard the next time you open HRISense on that device. If you left it unticked, you will be asked to sign in again.',
      troubleshooting: [
        {
          problem: 'I ticked it but I still have to sign in again.',
          solution: 'Sessions do expire after a period of inactivity, and clearing browser data ends them too. Simply sign in again.',
        },
        {
          problem: 'I ticked it by mistake on a shared computer.',
          solution: 'Sign out from the profile menu at the top right. Signing out clears the saved session on that computer.',
        },
      ],
      tips: ['If you are not sure whether a computer is shared, leave the box unticked.'],
      relatedGuideIds: ['AUTH_LOGIN', 'AUTH_LOGOUT'],
    },
  },

  {
    id: 'AUTH_FIRST_TIME_PASSWORD',
    slug: 'first-time-password-change',
    title: 'Setting Your Password on First Sign-In',
    shortDescription: 'Replace the temporary password HR gave you with one only you know.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['first login', 'temporary password', 'new account', 'must change password', 'set password'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: true,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    content: {
      purpose: 'Replace the temporary password issued by HR with a password that only you know.',
      whenToUse: 'The first time you sign in, and any time HR resets your password for you.',
      prerequisites: [
        'You have the temporary password from your welcome email, or HR gave it to you directly.',
        'You have signed in with that temporary password.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Sign in with the temporary password',
          instruction: 'Sign in as normal with your personal email (the one HR registered) and the temporary password.',
          explanation: 'HRISense knows the password is temporary and takes you straight to **Change Your Temporary Password**, which shows your registered email (partly hidden). Nothing else in HRISense opens until you set your own password — not even by typing another address.',
          expectedResult: 'The Change Your Temporary Password screen appears instead of your dashboard.',
          uiPath: 'Sign-in page -> Sign In to HRISense',
        },
        {
          stepNumber: 2,
          title: 'Enter your temporary password and your new one',
          instruction: 'Type the temporary password in **Current Temporary Password**. Type your new password in **New Password**, then type the same password again in **Confirm New Password**.',
          explanation: 'A checklist under the New Password box shows the rules. Every rule must be ticked before you can continue.',
          warning: 'Your new password must be different from the temporary one.',
          expectedResult: 'All the rules in the checklist turn green and the button becomes available.',
          uiPath: 'Change Password screen',
        },
        {
          stepNumber: 3,
          title: 'Save the new password',
          instruction: 'Select **Set New Password & Continue**.',
          expectedResult: 'Your dashboard opens. From now on you sign in with the new password.',
          uiPath: 'Change Password screen -> Set New Password & Continue',
        },
      ],
      whatHappensNext: 'The temporary password stops working immediately. Use your new password from now on. If you were also signed in on another computer or phone, that one is signed out and needs the new password. Not ready yet? Select **Sign out** on the same screen.',
      troubleshooting: [
        {
          problem: 'The save button stays greyed out.',
          solution: 'Look at the checklist under the New Password box. Every rule must be met, and the two new password boxes must match exactly.',
        },
        {
          problem: 'It says the current password is wrong.',
          solution: 'Type the temporary password carefully — it is easy to confuse letter O with the number 0. If it still fails, ask HR Personnel to issue a new one.',
        },
        {
          problem: 'I never received the welcome email.',
          solution: 'Check your junk or spam folder first. The welcome email goes to your personal email address. If it is not there, ask HR Personnel to send new credentials.',
        },
      ],
      tips: [
        'Choose something you can remember but others cannot guess. Do not use your birthday or your employee number.',
        'Never write your password on a note left at your workstation.',
      ],
      relatedGuideIds: ['AUTH_LOGIN', 'AUTH_CHANGE_PASSWORD', 'EMPLOYEE_MANAGE_ACCOUNT'],
    },
  },

  {
    id: 'AUTH_CHANGE_PASSWORD',
    slug: 'change-password',
    title: 'How to Change Your Password',
    shortDescription: 'Change the password of an account you are already signed in to.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['change password', 'update password', 'new password', 'security', 'settings'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    appLink: { to: '/settings', label: 'Settings' },
    content: {
      purpose: 'Set a new password while you are signed in, for regular security housekeeping.',
      whenToUse: 'When you think someone may have seen your password, or when you simply want to change it.',
      prerequisites: [
        'You are signed in and you know your current password.',
        'Your new password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Open Settings',
          instruction: 'Select **Settings** in the menu on the left, or open the profile menu at the top right and choose **Settings**. In the **Security** card, select **Change password**.',
          expectedResult: 'The Security card shows Current password, New password and Confirm new password boxes.',
          uiPath: 'Settings -> Security -> Change password',
        },
        {
          stepNumber: 2,
          title: 'Fill in the three boxes',
          instruction: 'Type your existing password in **Current password**, then your new password in **New password** and again in **Confirm new password**.',
          explanation: 'The checklist shows which password rules you have met so far.',
          expectedResult: 'The checklist is fully ticked and the update button becomes available.',
          uiPath: 'Settings -> Security',
        },
        {
          stepNumber: 3,
          title: 'Save',
          instruction: 'Select **Update password**.',
          explanation: 'HRISense checks your current password before saving, so nobody can change your password from a computer you left open without knowing it.',
          expectedResult: 'A confirmation message appears. The new password works immediately.',
          uiPath: 'Settings -> Security -> Update password',
        },
      ],
      whatHappensNext: 'Use the new password the next time you sign in.',
      troubleshooting: [
        {
          problem: 'It says my current password is incorrect.',
          solution: 'Type it again carefully. If you cannot remember it, sign out and use "Forgot password?" on the sign-in page.',
        },
        {
          problem: 'It says the new password must be different from the current one.',
          solution: 'Choose a password you are not already using. Reusing the same password is not allowed.',
        },
      ],
      tips: ['Changing your password does not affect any of your records — only how you sign in.'],
      relatedGuideIds: ['AUTH_FORGOT_PASSWORD', 'SETTINGS_OVERVIEW', 'AUTH_LOGIN'],
    },
  },

  {
    id: 'AUTH_FORGOT_PASSWORD',
    slug: 'forgot-password',
    title: 'What to Do If You Forgot Your Password',
    shortDescription: 'Ask HRISense to email you a link so you can set a new password yourself.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['forgot password', 'reset password', 'password link', 'cannot sign in', 'locked out', 'email'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    content: {
      purpose: 'Get back into your account when you cannot remember your password, without waiting for HR.',
      whenToUse: 'When the sign-in page keeps refusing your password and you are sure your email is correct.',
      prerequisites: [
        'You know the email address your HRISense account uses.',
        'You can open that mailbox.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Select "Forgot password?"',
          instruction: 'On the sign-in page, select **Forgot password?** underneath the Password box.',
          expectedResult: 'The Forgot Password page opens with a single email box.',
          uiPath: 'Sign-in page -> Forgot password?',
        },
        {
          stepNumber: 2,
          title: 'Type your email address and send',
          instruction: 'Type the email address your account uses, tick **I\'m not a robot** if it is shown, and select **Send reset link**.',
          explanation: 'For safety, HRISense always shows the same confirmation message, whether or not the address belongs to an account. That way nobody can use this page to discover who has an account.',
          expectedResult: 'A message confirms that if the address belongs to an account, a reset link has been sent to it.',
          uiPath: 'Forgot Password page -> Send reset link',
        },
        {
          stepNumber: 3,
          title: 'Open the link in your email',
          instruction: 'Open the message from HRISense and select **Choose a new password**. Follow the Reset Your Password guide from there.',
          warning: 'The link expires after a short time, and it can only be used once. If it has expired, simply request a new one.',
          expectedResult: 'The Reset Password page opens in your browser.',
          uiPath: 'Email -> Choose a new password',
        },
      ],
      whatHappensNext: 'Once you set a new password you can sign in with it straight away. Your old password stops working.',
      troubleshooting: [
        {
          problem: 'No email arrived.',
          solution: 'Wait a few minutes and check your junk or spam folder. Make sure you typed the address your account actually uses. If nothing arrives, ask HR Personnel to reset your password for you.',
        },
        {
          problem: 'The link says it is invalid or has expired.',
          solution: 'Request a new reset link from the sign-in page. Each link can only be used once.',
        },
      ],
      tips: ['If you are in a hurry, HR Personnel can issue new credentials immediately from your employee record.'],
      relatedGuideIds: ['AUTH_RESET_PASSWORD', 'AUTH_LOGIN', 'EMPLOYEE_MANAGE_ACCOUNT'],
    },
  },

  {
    id: 'AUTH_RESET_PASSWORD',
    slug: 'reset-password',
    title: 'Setting a New Password from the Emailed Link',
    shortDescription: 'Finish a password reset using the link HRISense emailed you.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['reset password', 'reset link', 'new password', 'password email', 'expired link'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    content: {
      purpose: 'Set a brand-new password using the one-time link sent to your email.',
      whenToUse: 'Right after you request a reset link from the sign-in page.',
      prerequisites: [
        'You have the reset email in front of you.',
        'The link has not expired and has not already been used.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Open the link',
          instruction: 'Select **Choose a new password** in the email, or copy the address shown underneath the button into your browser.',
          expectedResult: 'The Reset Password page opens.',
          uiPath: 'Email -> Choose a new password',
        },
        {
          stepNumber: 2,
          title: 'Type your new password twice',
          instruction: 'Type the new password in **New Password**, then again in **Confirm New Password**.',
          explanation: 'The checklist shows the rules your password must meet.',
          expectedResult: 'The checklist is fully ticked.',
          uiPath: 'Reset Password page',
        },
        {
          stepNumber: 3,
          title: 'Save and sign in',
          instruction: 'Select **Set new password**, then sign in with the password you just chose.',
          expectedResult: 'A confirmation appears and you are returned to the sign-in page.',
          uiPath: 'Reset Password page -> Set new password',
        },
      ],
      whatHappensNext: 'The reset link is used up and cannot be opened again. Your new password works immediately.',
      troubleshooting: [
        {
          problem: 'The page says the link is no longer valid.',
          solution: 'Request a new one with "Forgot password?" on the sign-in page. Links expire and can only be used once.',
        },
        {
          problem: 'The save button will not turn on.',
          solution: 'Check the rules checklist and make sure both password boxes match exactly.',
        },
      ],
      tips: ['If you did not ask for a reset, you can ignore the email — your password is unchanged. Tell HR Personnel if it keeps happening.'],
      relatedGuideIds: ['AUTH_FORGOT_PASSWORD', 'AUTH_LOGIN'],
    },
  },

  {
    id: 'AUTH_LOGOUT',
    slug: 'sign-out',
    title: 'How to Sign Out Safely',
    shortDescription: 'End your session properly, especially on a shared hospital computer.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['sign out', 'log out', 'logout', 'exit', 'end session', 'shared computer'],
    estimatedSteps: 2,
    screenshotRecommended: false,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED,
    content: {
      purpose: 'Close your HRISense session so nobody else can use your account.',
      whenToUse: 'Every time you finish working on a shared computer, and whenever you step away from your desk.',
      prerequisites: ['You are signed in to HRISense.'],
      steps: [
        {
          stepNumber: 1,
          title: 'Open your profile menu',
          instruction: 'Select your name or photo at the top right of the screen.',
          expectedResult: 'A short menu appears with My Profile, Settings and Sign Out.',
          uiPath: 'Top bar -> your name',
        },
        {
          stepNumber: 2,
          title: 'Select Sign Out',
          instruction: 'Select **Sign Out**.',
          explanation: 'HRISense closes your session on this device. Simply closing the browser tab is not the same thing.',
          expectedResult: 'You are returned to the sign-in page.',
          uiPath: 'Profile menu -> Sign Out',
        },
      ],
      whatHappensNext: 'Anyone who opens HRISense on that computer afterwards has to sign in with their own account.',
      troubleshooting: [
        {
          problem: 'I closed the browser without signing out on a shared computer.',
          solution: 'Sign in again on that computer and sign out properly. If you had ticked "Keep me signed in", this is the only way to clear the saved session.',
        },
      ],
      tips: ['Signing out on one computer does not sign you out on your other devices.'],
      relatedGuideIds: ['AUTH_LOGIN', 'AUTH_REMEMBER_ME'],
    },
  },

  {
    id: 'AUTH_GOOGLE_SIGN_IN',
    slug: 'sign-in-with-google',
    title: 'How to Sign In with Google',
    shortDescription: 'Use Continue with Google instead of typing your password — only with the Google account that uses your registered email.',
    module: 'Authentication',
    category: 'AUTH',
    roles: ['FULL', 'SUPERVISOR', 'STANDARD'],
    keywords: ['google', 'sign in with google', 'continue with google', 'gmail', 'google account', 'login', 'sign in'],
    estimatedSteps: 3,
    screenshotRecommended: true,
    sensitiveScreenshot: false,
    contentStatus: 'READY',
    lastReviewed: REVIEWED_OCT,
    content: {
      purpose: 'Sign in to your own HRISense account through Google, without typing your HRISense password.',
      whenToUse: 'When **Continue with Google** appears on the sign-in page and your Google account uses the same email HR registered for you.',
      prerequisites: [
        'HR has already created your HRISense account. Google sign-in never creates an account.',
        'Your Google account email is exactly the personal email HR recorded as your login.',
        'Your browser allows pop-ups for the HRISense address.',
      ],
      steps: [
        {
          stepNumber: 1,
          title: 'Choose whether to stay signed in',
          instruction: 'On the sign-in page, tick **Keep me signed in** only if this is your own device.',
          expectedResult: 'The tick box shows your choice. It works the same way as for a password sign-in.',
          uiPath: 'Sign-in page -> Keep me signed in',
        },
        {
          stepNumber: 2,
          title: 'Select Continue with Google',
          instruction: 'Under the **Sign In to HRISense** button, select **Continue with Google**, then pick your Google account in the Google window.',
          explanation: 'If you close the Google window, nothing happens — you can simply try again or sign in with your password.',
          expectedResult: 'The Google window closes and HRISense signs you in.',
          uiPath: 'Sign-in page -> Continue with Google',
        },
        {
          stepNumber: 3,
          title: 'Continue as usual',
          instruction: 'You land on your dashboard. If your account still has a temporary password, HRISense first asks you to set your own password, exactly as with a normal sign-in.',
          expectedResult: 'You are signed in with the same access you always have.',
          uiPath: 'Dashboard',
        },
      ],
      whatHappensNext: 'You use HRISense exactly as after a password sign-in. Your access comes from your HRISense account, never from Google.',
      troubleshooting: [
        {
          problem: 'It says no HRISense account is registered with this Google email.',
          solution: 'Your Google email is not the personal email on your HRISense account. Sign in with your email and password, or ask HR which email is registered. Do not keep trying other Google accounts — repeated attempts with unregistered emails block Google sign-in on your network for a while.',
        },
        {
          problem: 'It says Google sign-in is blocked on this network.',
          solution: 'Several unregistered Google accounts were tried from your network. Sign in with your email and password; Google sign-in comes back after about 30 minutes.',
        },
        {
          problem: 'It says my account is locked or deactivated.',
          solution: 'Google sign-in follows the same account rules as a password. Ask HR Personnel to unlock a locked account or reactivate a deactivated one.',
        },
        {
          problem: 'I do not see Continue with Google.',
          solution: 'Google sign-in is switched on by HRISense administrators. If it is not shown, sign in with your email and password.',
        },
      ],
      tips: ['Signing out of HRISense does not sign you out of Google on that computer. On a shared computer, sign out of Google too.'],
      relatedGuideIds: ['AUTH_LOGIN', 'AUTH_REMEMBER_ME', 'AUTH_FIRST_TIME_PASSWORD', 'AUTH_LOGOUT'],
    },
  },
];
