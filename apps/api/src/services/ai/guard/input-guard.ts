import { PermissionTier } from '@prisma/client';

/**
 * Deterministic checks on the user's message, BEFORE any model is involved.
 *
 * These are a first line of defence and a cost control — not the security
 * boundary (that is the tools' own authorization). They catch the requests
 * whose answer is always "no", so they are refused consistently, instantly and
 * without sending anything to a provider:
 *
 *   SECRETS    asking for passwords, keys, tokens, hashes, .env values
 *   SQL        SQL statements / injection fragments / "run this query"
 *   INJECTION  attempts to override instructions or claim a higher role
 *   PAYROLL    payroll/salary questions (HRISense has no payroll)
 *   OFF_TOPIC  clearly unrelated requests with no HRISense term at all
 *
 * Anything ambiguous is ALLOWED through; the model then applies the policy and
 * the server enforces the out-of-scope wording.
 */

export type GuardVerdict = 'ALLOW' | 'SECRETS' | 'SQL' | 'INJECTION' | 'PAYROLL' | 'OFF_TOPIC';

export interface GuardResult {
  verdict: GuardVerdict;
  /** Which rule matched, for the audit log (never the matched text). */
  rule?: string;
}

const PASSWORD_HELP = /\b(change|changing|reset|resetting|forgot|forgotten|forget|update|set|expired|expire|locked|lock(ed)? out|unlock|recover|how (do|can|to|should)|where (do|can)|requirements?|rules?|strong|policy|must change)\b/i;

const SECRET_RULES: Array<[string, RegExp]> = [
  ['credential-noun', /\b(api[\s_-]?keys?|secret[\s_-]?keys?|client[\s_-]?secrets?|access[\s_-]?tokens?|refresh[\s_-]?tokens?|bearer[\s_-]?tokens?|session[\s_-]?(tokens?|ids?|cookies?)|reset[\s_-]?tokens?|jwts?|json web tokens?|private[\s_-]?keys?|password[\s_-]?hash(es)?|hash(ed)?[\s_-]?passwords?|bcrypt|connection[\s_-]?strings?|database[\s_-]?(password|credentials?|url)|\.env\b|env(ironment)?[\s_-]?(variables?|vars?|file)|openai[\s_-]?key|anthropic[\s_-]?key)\b/i],
  ['secret-literal', /\b(sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|\$2[aby]\$\d{2}\$)/],
];

const PASSWORD_ASK = /\b(show|give|tell|reveal|list|print|dump|display|send|share|leak|get|fetch|retrieve|read|see|know|what(?:'s| is| are| was)|whats)\b[^.?!\n]{0,50}\b(passwords?|passcodes?|pins?|credentials?)\b|\b(passwords?|credentials?)\s+(of|for)\s+(\w+\s){0,3}(employees?|users?|staff|everyone|all|him|her|them|hr|admin|[A-Z][a-z]+)/i;

const SQL_RULES: Array<[string, RegExp]> = [
  ['select-star', /\bselect\s+\*\s+from\b/i],
  ['union-select', /\bunion\s+(all\s+)?select\b/i],
  ['ddl', /\b(drop|truncate|alter|create)\s+(table|database|schema|index|user)\b/i],
  ['dml-delete', /\bdelete\s+from\s+[`"\w]+/i],
  ['dml-insert', /\binsert\s+into\s+[`"\w]+/i],
  ['dml-update', /\bupdate\s+[`"\w]+\s+set\s+[`"\w]+\s*=/i],
  ['select-clause', /\bselect\b[^.?!\n]{1,120}\bfrom\s+[`"\w.]+\s+(where|join|limit|order\s+by|group\s+by)\b/i],
  ['tautology', /['"]\s*or\s*['"]?\d+['"]?\s*=\s*['"]?\d+|\bor\s+1\s*=\s*1\b/i],
  ['comment', /;\s*--|\/\*.*\*\//],
  ['meta', /\b(information_schema|pg_catalog|sqlite_master|xp_cmdshell|sleep\s*\(\s*\d+\s*\)|benchmark\s*\()/i],
  ['run-query', /\b(run|execute|exec)\s+(this\s+|the\s+|a\s+|an\s+|my\s+)?(raw\s+)?(sql|query|queries|script|code|command|statement)\b/i],
  ['table-dump', /\b(dump|export|show|list)\s+(the\s+|all\s+)?(database|tables?|schema)\b/i],
];

const INJECTION_RULES: Array<[string, RegExp]> = [
  ['ignore-instructions', /\b(ignore|disregard|forget|override|bypass|skip|drop)\s+(all\s+|any\s+|the\s+|your\s+|my\s+|previous\s+|prior\s+|above\s+|earlier\s+|system\s+|these\s+)*(instructions?|rules|prompts?|guidelines|restrictions|polic(y|ies)|guardrails|safeguards|constraints)\b/i],
  ['reveal-prompt', /\b(reveal|show|print|repeat|output|display|tell me|what (is|are))\b[^.?!\n]{0,30}\b(system\s+prompt|hidden\s+prompt|initial\s+prompt|your\s+(instructions|rules|prompt|guidelines))\b/i],
  ['role-play', /\b(pretend|act|behave|roleplay|role-play|imagine|assume|simulate)\b[^.?!\n]{0,40}\b(i\s+am|i'm|im|me\s+as|as\s+(an?\s+)?|you\s+are)\b[^.?!\n]{0,30}\b(hr|admin|administrator|supervisor|manager|developer|root|superuser|system|full\s+access|it\s+staff)\b/i],
  ['mode-switch', /\b(developer|debug|god|admin|sudo|jailbreak|dan|unrestricted|maintenance)\s+mode\b|\byou\s+are\s+now\b|\bnew\s+(system\s+)?instructions\s*:|^\s*system\s*:/im],
  // Imperatives only ("give me HR access", "switch my role to admin"); a question
  // such as "how do I change my role?" is a legitimate how-to and is allowed.
  ['grant-access', /(^|[.!?]\s+)(please\s+)?(give|grant|elevate|upgrade|switch|change|set|make)\s+(me|my\s+(role|tier|access|access\s+level|permissions?|account))\b[^.?!\n]{0,30}\b(hr|admin|administrator|full|supervisor|access|permissions?|privileges?)\b/i],
];

/** Claims of a role the user does not hold. A real HR user saying "I'm HR" is fine. */
function falseRoleClaim(text: string, tier: PermissionTier): string | null {
  const claimHr = /\b(i\s+am|i'm|im)\s+(an?\s+|the\s+)?(hr|h\.r\.|human\s+resources?|hr\s+officer|admin|administrator|superuser|system\s+admin)\b/i.test(text);
  if (claimHr && tier !== PermissionTier.FULL) return 'false-hr-claim';
  const claimSupervisor = /\b(i\s+am|i'm|im)\s+(an?\s+|the\s+|their\s+|his\s+|her\s+)?(supervisor|manager|head|team\s+lead)\b/i.test(text);
  if (claimSupervisor && tier === PermissionTier.STANDARD) return 'false-supervisor-claim';
  return null;
}

const PAYROLL = /\b(payroll|payslips?|pay\s?slips?|salary|salaries|wages?|13th[\s-]month|net\s+pay|gross\s+pay|take[\s-]home\s+pay|tax\s+withh?olding|withholding\s+tax|pay\s?check|paycheque|pay\s+rate|hourly\s+rate|compensation)\b/i;

/**
 * Words that tie a message to HRISense / HR work. A message containing any of
 * these is never refused as off-topic by the guard.
 */
const DOMAIN = /\b(hrisense|hsj|hospicio|attendance|attend\w*|absen\w*|present|late|leave|leaves|vacation|sick|emergency|maternity|paternity|bereavement|schedule\w*|shift\w*|day\s?off|rest\s?day|overtime|undertime|time\s?in|time\s?out|clock\w*|punch\w*|biometric|timekeeping|mustard|import\w*|tally|holiday\w*|calendar|training\w*|seminar\w*|workshop\w*|orientation|evaluat\w*|appraisal|performance|rating|compliance|complian\w*|requirement\w*|licen[cs]e\w*|prc|certificat\w*|medical|psycholog\w*|psych|health|announcement\w*|notification\w*|employee\w*|staff|team\w*|supervis\w*|subordinate\w*|direct\s+reports?|hr|human\s+resources?|recruit\w*|applicant\w*|application\w*|job\s+opening\w*|opening\w*|hiring|hire\w*|interview\w*|onboard\w*|profile|201|documents?|org\s?chart|unit\w*|department\w*|job\s+role\w*|position\w*|headcount|workforce|report\w*|dashboard|audit\w*|password\w*|log\s?in|sign\s?in|sign\s?out|account|help\s?center|guide\w*|settings|endorse\w*|approv\w*|reject\w*|balance\w*|regulari[sz]ation|probation\w*|resign\w*|separation|archiv\w*|my\s+(record|data|info|details)|who\s+(is|are)\s+(in|on|working)|working|work|duty|coworker\w*|colleague\w*|manager)\b/i;

const OFF_TOPIC = /\b(recipes?|cook(ing)?|bake|weather|forecast|stock\s+(price|market)|bitcoin|crypto\w*|nba|basketball\s+score|football|soccer|movies?|films?|songs?|lyrics|poem|poetry|jokes?|riddle|stor(y|ies)|essay|homework|math(s|ematics)?|equation|integral|derivative|solve\s+for|capital\s+of|president\s+of|celebrit\w*|video\s?games?|horoscope|zodiac|dating|girlfriend|boyfriend|love\s+letter|travel|tourist|restaurants?|news|politic\w*|election\w*|chatgpt|trivia|who\s+invented|translate|write\s+(me\s+)?(a\s+|an\s+|some\s+)?(python|javascript|java|c\+\+|c#|php|sql|html|css|code|program|script|function|app|website|poem|song|story|essay|letter|email)|(python|javascript|typescript|java|react|node)\s+(code|script|program|function))\b/i;

export function classifyInput(message: string, tier: PermissionTier): GuardResult {
  const text = message.normalize('NFKC');

  for (const [rule, re] of SECRET_RULES) if (re.test(text)) return { verdict: 'SECRETS', rule };
  if (PASSWORD_ASK.test(text) && !PASSWORD_HELP.test(text)) return { verdict: 'SECRETS', rule: 'password-ask' };

  for (const [rule, re] of SQL_RULES) if (re.test(text)) return { verdict: 'SQL', rule };

  for (const [rule, re] of INJECTION_RULES) if (re.test(text)) return { verdict: 'INJECTION', rule };
  const claim = falseRoleClaim(text, tier);
  if (claim) return { verdict: 'INJECTION', rule: claim };

  if (PAYROLL.test(text)) return { verdict: 'PAYROLL', rule: 'payroll' };

  if (OFF_TOPIC.test(text) && !DOMAIN.test(text)) return { verdict: 'OFF_TOPIC', rule: 'off-topic' };

  return { verdict: 'ALLOW' };
}

/**
 * Control characters, zero-width characters and bidirectional overrides —
 * used to hide text from a human reader. Built from code points so the source
 * file contains no invisible characters itself.
 */
const INVISIBLE = new RegExp(
  '[' +
    [
      [0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f],
      [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff],
    ]
      .map(([a, b]) => `${String.fromCharCode(92)}u${a.toString(16).padStart(4, '0')}-${String.fromCharCode(92)}u${b.toString(16).padStart(4, '0')}`)
      .join('') +
    ']',
  'g'
);

/** Trims, strips invisible characters and collapses runs of whitespace. */
export function normaliseMessage(raw: string): string {
  return raw
    .replace(INVISIBLE, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
