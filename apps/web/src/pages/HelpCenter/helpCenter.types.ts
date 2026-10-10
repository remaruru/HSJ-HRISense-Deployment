/**
 * Help Center content model.
 *
 * `HelpRole` mirrors the three HRISense permission tiers, plus PUBLIC for the
 * pages a visitor can reach without signing in (the Careers pages and the
 * application status link). PUBLIC guides are written for the people who have to
 * explain those pages — HR Personnel — because the Help Center itself is only
 * reachable after signing in.
 */
export type HelpRole = 'FULL' | 'SUPERVISOR' | 'STANDARD' | 'PUBLIC';

export type HelpContentStatus = 'METADATA_ONLY' | 'DRAFT' | 'READY';

export type HelpCategoryCode =
  | 'AUTH'
  | 'DASHBOARD'
  | 'EMPLOYEES'
  | 'RECRUITMENT'
  | 'PUBLIC_RECRUITMENT'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'EVALUATIONS'
  | 'TRAINING'
  | 'RECOGNITION'
  | 'COMPLIANCE'
  | 'ANNOUNCEMENTS'
  | 'NOTIFICATIONS'
  | 'AUDIT'
  | 'AI_ASSISTANCE'
  | 'REPORTS'
  | 'SETTINGS'
  | 'HELP';

export interface HelpCategory {
  code: HelpCategoryCode;
  name: string;
  shortDescription: string;
  iconName: string;
  order: number;
}

export interface HelpScreenshot {
  src: string;
  alt: string;
  caption?: string;
  sensitive?: boolean;
  highlightDescription?: string;
}

export interface HelpTroubleshootingItem {
  problem: string;
  solution: string;
  note?: string;
}

export interface HelpGuideStep {
  stepNumber: number;
  title: string;
  instruction: string;
  explanation?: string;
  tip?: string;
  warning?: string;
  info?: string;
  screenshot?: HelpScreenshot;
  expectedResult?: string;
  uiPath?: string;
}

export interface HelpGuideContent {
  purpose: string;
  whenToUse?: string;
  prerequisites: string[];
  steps: HelpGuideStep[];
  whatHappensNext?: string;
  troubleshooting?: HelpTroubleshootingItem[];
  tips?: string[];
  relatedGuideIds?: string[];
}

export interface HelpGuideDefinition {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  module: string;
  category: HelpCategoryCode;
  roles: HelpRole[];
  keywords: string[];
  estimatedSteps: number;
  screenshotRecommended: boolean;
  sensitiveScreenshot: boolean;
  contentStatus: HelpContentStatus;
  isRecommended?: boolean;
  relatedGuideIds?: string[];
  lastReviewed?: string | null;
  /**
   * The HRISense screen this guide is about — shown as an "Open …" button.
   * Must be a real route every reader of the guide can open.
   */
  appLink?: { to: string; label: string };
  content?: HelpGuideContent;
}

export interface HelpSearchResult {
  guide: HelpGuideDefinition;
  score: number;
  matchType: 'EXACT_TITLE' | 'TITLE_MATCH' | 'KEYWORD_MATCH' | 'CATEGORY_MATCH' | 'DESCRIPTION_MATCH';
}
