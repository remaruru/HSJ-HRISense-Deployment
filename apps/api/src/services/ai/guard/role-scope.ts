import { PermissionTier } from '@prisma/client';

/**
 * Role-scope routing: questions from supervisors and employees that have exactly
 * one right answer because of where they sit in the hierarchy. The server answers
 * these itself, so no model can misread them or add records nobody asked for, and
 * nothing is sent to a provider:
 *
 *   HR_CONTACT        how to reach HR
 *   HR_DETAILS        HR staff's details or profile: outside their access, so how to reach HR
 *   SUPERVISOR_NAME   who their immediate supervisor is
 *   SUPERVISOR_DETAILS  their supervisor's details: outside their access
 *   OTHER_RECORDS     an employee asking about other people's records
 *
 * Anything else, including every question about the person's own records, how-to
 * questions and anything in Filipino or Taglish (answered in that language), goes
 * to the model, which follows the same rules from the policy.
 *
 * Pure, so every wording is unit-tested. Like the input guard this is not the
 * security boundary: that is the tools' own authorization.
 */
export type ScopeRoute = 'HR_CONTACT' | 'HR_DETAILS' | 'SUPERVISOR_NAME' | 'SUPERVISOR_DETAILS' | 'OTHER_RECORDS';

const FILIPINO = /\b(po|paano|pano|ano|sino|saan|nasaan|kanino|makokontak|kontakin|kausapin|makausap|tawagan|numero|ba|ko|ng|ang|mga|kay|sa)\b/i;

const MENTIONS_HR = /\b(hr|h\.r\.|human resources?)\b/i;
const MENTIONS_SUPERVISOR = /\b(supervisor|immediate head|boss)\b/i;

/** A question about something HR or a supervisor DOES, not about them: the model answers it. */
const ABOUT_A_PROCESS =
  /\b(approves?|approved|endorses?|endorsed|reviews?|reviewed|process|policy|files?|filed|submits?|submitted|sees?|views?|access|updates?|changes?|edits?|resets?|forgot|password|leave|attendance|schedules?|training|evaluations?|compliance|opens?|closes?|hours|responsibilit\w+|employees)\b/i;

/** The asker's own details, as in "can HR see my profile". */
const OWN_DETAILS = /\bmy\s+(hr\s+)?(details?|info|information|profile|records?|contacts?|number|phone|e-?mail|address|birthday|age|data)\b/i;

const PERSONAL_RECORD = /\b(profiles?|records?|birthdays?|birth\s*dates?|age|address(es)?|personal)\b/i;
const CONTACT_WORD = /\b(contacts?|number|phone|telephone|tel|mobile|e-?mail|location|office|connect|talk|speak|reach|call|message|get in touch)\b/i;
const DETAILS_WORD = /\b(details?|info|information)\b/i;
const WHO_OR_WHERE_IS_HR = /^(who|where)(?:'s| is| are)\s+(the\s+)?(hr|h\.r\.|human resources?)\b/i;

const WHO_IS_MY_SUPERVISOR = /^(who(?:'s| is)|what(?:'s| is) the name of)\s+(my|the)\s+(immediate\s+)?(supervisor|head|boss)\s*\??$/i;

// "who's employee lack of documents", "psychological results of employees", "everyone's birthdays"
const OTHER_PEOPLE =
  /\b(employees|employees'|employee's|other employees?|other staff|other people|others|co-?workers?|co-?workers?'s?|colleagues?|teammates?|everyone|everyone's|everybody|everybody's|anyone else|all (the )?staff|who(?:'s|s)? employee|which employee)\b/i;
const THEIR_RECORDS =
  /\b(documents?|requirements?|compliance|clearances?|psychological|psych|medical|health|evaluations?|ratings?|attendance|absent|late|leave|balances?|records?|birthdays?|birth\s*dates?|age|address(es)?|phone|numbers?|contacts?)\b/i;
/** "my" that is about the asker, not "my co-worker". */
const ABOUT_THE_ASKER = /\b(i|me|mine|my(?!\s+(co-?workers?|colleagues?|teammates?)))\b/i;
const HOW_TO = /^(how|what (are|does|do)|why|when|where|can i|do i|is it)\b|^what(?:'s| is)\b(?!.*\b(co-?workers?|colleagues?|teammates?|everyone|everybody|employee's)\b)/i;

export function classifyScope(question: string, tier: PermissionTier): ScopeRoute | null {
  if (tier === PermissionTier.FULL) return null;
  const q = question.trim().replace(/[’‘]/g, "'");
  if (FILIPINO.test(q)) return null;

  if (MENTIONS_HR.test(q) && !ABOUT_A_PROCESS.test(q) && !OWN_DETAILS.test(q)) {
    if (PERSONAL_RECORD.test(q)) return 'HR_DETAILS';
    if (CONTACT_WORD.test(q) || WHO_OR_WHERE_IS_HR.test(q)) return 'HR_CONTACT';
    if (DETAILS_WORD.test(q)) return 'HR_DETAILS';
  }

  if (MENTIONS_SUPERVISOR.test(q)) {
    if (WHO_IS_MY_SUPERVISOR.test(q)) return 'SUPERVISOR_NAME';
    if (!ABOUT_A_PROCESS.test(q) && !OWN_DETAILS.test(q) && (PERSONAL_RECORD.test(q) || CONTACT_WORD.test(q) || DETAILS_WORD.test(q))) {
      return 'SUPERVISOR_DETAILS';
    }
  }

  // A supervisor's "employees" are their direct reports, which they may see: the model answers that.
  if (tier === PermissionTier.STANDARD && OTHER_PEOPLE.test(q) && THEIR_RECORDS.test(q) && !ABOUT_THE_ASKER.test(q) && !HOW_TO.test(q)) {
    return 'OTHER_RECORDS';
  }
  return null;
}

/** What the employee asked about, in words for the answer, and whether it is confidential. */
export function describeRecords(question: string): { topic: string; confidential: boolean } {
  if (/\b(psychological|psych)\b/i.test(question)) return { topic: 'psychological results', confidential: true };
  if (/\b(medical|health)\b/i.test(question)) return { topic: 'medical records', confidential: true };
  if (/\b(documents?|requirements?|compliance|clearances?)\b/i.test(question)) return { topic: 'compliance documents', confidential: false };
  if (/\b(evaluations?|ratings?)\b/i.test(question)) return { topic: 'evaluations', confidential: true };
  if (/\b(attendance|absent|late)\b/i.test(question)) return { topic: 'attendance', confidential: false };
  if (/\b(leave|balances?)\b/i.test(question)) return { topic: 'leave records', confidential: false };
  if (/\b(birthdays?|birth\s*dates?|age|address(es)?|phone|numbers?|contacts?)\b/i.test(question)) return { topic: 'personal details', confidential: true };
  return { topic: 'records', confidential: false };
}
