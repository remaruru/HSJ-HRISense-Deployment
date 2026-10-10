/**
 * Checks that the name beside a device number in the export still belongs to the
 * employee that number is mapped to - and, when it does not, proposes who it
 * probably is so HR can confirm with one click.
 *
 * -- The distinction this file rests on -------------------------------------
 * Names are NEVER used to decide who someone is. Matching is on `biometricCode`
 * and nothing else, exactly as before. Names are used here for two other things:
 *
 *   1. VERIFICATION - "code 101 is mapped to Juan, but the file calls it Maria".
 *      That is a question, not an answer. The row is held and HR decides.
 *   2. SUGGESTION - "of the people in HRISense, this name is closest to Maria".
 *      Also a question. HR confirms or picks someone else.
 *
 * Neither ever assigns attendance on its own. That is what keeps the ban on
 * fuzzy name matching intact: fuzziness may raise a question, never settle one.
 *
 * -- What leaves this module ------------------------------------------------
 * A verdict, a score, and HRISense employee ids. The name read from the file is
 * an argument to these functions and goes no further - nothing here returns it,
 * stores it, or writes it to a log.
 */

/** Result of comparing one source name against the employee its code resolved to. */
export type IdentityVerdict =
  /** The names agree well enough to trust the mapping. */
  | 'MATCH'
  /** The names disagree. The code may have been reassigned to someone else. */
  | 'MISMATCH'
  /** Close, but not close enough to wave through. */
  | 'UNCERTAIN'
  /** The file carried no name to check against. */
  | 'NO_NAME_IN_SOURCE'
  /** The code resolved to nobody, so there was nothing to compare with. */
  | 'NO_EMPLOYEE_TO_CHECK';

export interface EmployeeNameRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
}

export interface IdentityCheck {
  verdict: IdentityVerdict;
  /** 0-100. How close the source name was to the employee it is mapped to. */
  score: number | null;
  /** Closest employee in HRISense by name, for HR to confirm. Never auto-applied. */
  suggestedEmployeeId: string | null;
  /** 0-100 for the suggestion above. */
  suggestedScore: number | null;
}

/**
 * Names agreeing at or above this are treated as the same person.
 *
 * Set from what actually varies between a bio device and an HR record: middle
 * names present on one side only, "MA." for "MARIA", extra spacing, a suffix.
 * Those land well above 80 once the name is token-normalised. A genuinely
 * different person lands far below.
 */
const MATCH_THRESHOLD = 80;
/** Below this the names are not plausibly the same person. */
const MISMATCH_THRESHOLD = 55;
/** A suggestion weaker than this is not worth showing - it would only mislead. */
const SUGGESTION_FLOOR = 50;
/**
 * No single part of a name may match worse than this for the pair to count as the
 * same person. Guards the "ANTONIO / ANTONIA" case, where a perfect surname drags
 * the average over the line while the first name is a different person's.
 */
const WEAKEST_TOKEN_FLOOR = 90;
/**
 * How closely a real word must match to anchor a comparison. High on purpose:
 * the anchor is what licenses everything else, so it has to be a word both
 * sides clearly share, not a lucky overlap of letters.
 */
const ANCHOR_SIMILARITY = 0.8;

/**
 * Reduces a name to comparable tokens.
 *
 * Case, punctuation and spacing are all noise: the device writes
 * "DELA CRUZ, JUAN P." where HRISense holds "Juan", "P", "Dela Cruz".
 *
 * Order is PRESERVED. Comparison is order-independent anyway - every token looks
 * for its best partner on the other side - and keeping the original order is what
 * lets adjacent tokens be merged, which is how "DELA CRUZ" is recognised as
 * "DELACRUZ". Sorting would scatter those two apart and lose the match.
 */
export function normalizeNameTokens(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ') // commas, periods, hyphens become spaces
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Bigrams of a token, for Dice similarity. */
function bigrams(value: string): string[] {
  if (value.length < 2) return [value];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i++) out.push(value.slice(i, i + 2));
  return out;
}

/** Dice coefficient, 0-1. */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  const pool = new Map<string, number>();
  for (const g of A) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of B) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hits++;
      pool.set(g, n - 1);
    }
  }
  return (2 * hits) / (A.length + B.length);
}

/**
 * Every token of a side, plus each adjacent PAIR joined together.
 *
 * This is what makes a compound surname survive a spacing difference: the device
 * writes "DELACRUZ" and HRISense holds "Dela Cruz", so "DELA" and "CRUZ" are
 * offered as "DELACRUZ" too and the pair matches exactly instead of scoring like
 * two unrelated words.
 */
function tokensWithMerges(tokens: readonly string[]): string[] {
  const out = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + tokens[i + 1]);
  return out;
}

/** How well one token matches anything on the other side, 0-1. */
function bestTokenScore(token: string, others: readonly string[]): number {
  let best = 0;
  for (const other of others) {
    // An initial standing in for a full name ("P" for "PEREZ", "MA" for
    // "MARIA") is a match, not a near-miss - devices abbreviate constantly.
    const initialMatch =
      (token.length <= 2 && other.startsWith(token)) ||
      (other.length <= 2 && token.startsWith(other));
    const score = initialMatch ? 1 : dice(token, other);
    if (score > best) best = score;
  }
  return best;
}

/**
 * How close two names are.
 *
 * Token-set based: every token on the shorter side is matched to its best partner
 * on the other, and `score` is the mean. A token the other side simply does not
 * have (an absent middle name) costs far less than a token that is present but
 * different - which is exactly the difference between "the same person recorded
 * twice" and "two different people".
 *
 * `weakest` is the worst single token match, and it exists because the mean alone
 * is too forgiving in the one direction that matters. "REYES ANTONIO" and
 * "REYES ANTONIA" average 92 - a surname matching perfectly hides a first name
 * that is one letter from being somebody else. Scoring the weakest link
 * separately lets a MATCH require that NO part of the name is shaky, so that pair
 * becomes a question for HR instead of a silent pass.
 */
export function compareNames(a: string, b: string): { score: number; weakest: number } {
  const A = normalizeNameTokens(a);
  const B = normalizeNameTokens(b);
  if (!A.length || !B.length) return { score: 0, weakest: 0 };

  const [shortSide, longSide] = A.length <= B.length ? [A, B] : [B, A];
  const shortPool = tokensWithMerges(shortSide);
  const longPool = tokensWithMerges(longSide);

  /*
   * An ANCHOR is required before any of the scoring below means anything: at
   * least one real word (3+ letters) must genuinely match a real word on the
   * other side, on its own merits and not through the initials shortcut.
   *
   * Without it, initials become wildcards. Found against the official export:
   * "ACOSTA, GUADA" scored 51 against the HRISense record "Staff, Rendu A",
   * because the lone "A" was read as an initial and then matched every word
   * beginning with A - enough to be offered to HR as a suggestion. "Rendu B"
   * scored 7. A single letter must be able to SUPPORT a match, never create one.
   */
  const anchored = shortSide.some(
    (token) =>
      token.length >= 3 &&
      longPool.some((other) => other.length >= 3 && dice(token, other) >= ANCHOR_SIMILARITY)
  );
  if (!anchored) return { score: 0, weakest: 0 };

  let total = 0;
  let weakest = 1;
  for (const token of shortSide) {
    const best = bestTokenScore(token, longPool);
    total += best;
    if (best < weakest) weakest = best;
  }
  const mean = total / shortSide.length;

  // Tokens the longer side has and the shorter side lacks are only mildly
  // penalised: a missing middle name must not read as a different person. A
  // surplus token that IS accounted for - the "CRUZ" absorbed into "DELACRUZ" -
  // costs nothing, so the penalty only counts the ones nothing explains.
  const unexplained = longSide.filter((t) => bestTokenScore(t, shortPool) < 0.6).length;
  const penalty = Math.min(0.15, unexplained * 0.05);

  return {
    score: Math.round(Math.max(0, mean - penalty) * 100),
    weakest: Math.round(weakest * 100),
  };
}

/** How close two names are, 0-100. See `compareNames`. */
export function nameSimilarity(a: string, b: string): number {
  return compareNames(a, b).score;
}

/** The employee's name as HRISense holds it. */
function employeeFullName(e: EmployeeNameRecord): string {
  return [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ').trim();
}

/**
 * Verifies one source name and, when useful, proposes who it looks like.
 *
 * @param sourceName the name read from the file - used here and nowhere else
 * @param mappedEmployee the employee the code resolved to, or null
 * @param candidates every employee the suggestion may choose from
 */
export function verifyIdentity(
  sourceName: string | null,
  mappedEmployee: EmployeeNameRecord | null,
  candidates: readonly EmployeeNameRecord[]
): IdentityCheck {
  if (!sourceName) {
    return {
      verdict: 'NO_NAME_IN_SOURCE',
      score: null,
      suggestedEmployeeId: null,
      suggestedScore: null,
    };
  }

  // The best-matching employee overall. Computed even when the mapping looks
  // right, because it is what lets the review screen offer a one-click fix.
  let bestId: string | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const full = employeeFullName(candidate);
    if (!full) continue;
    const score = nameSimilarity(sourceName, full);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }
  const suggestion =
    bestScore >= SUGGESTION_FLOOR
      ? { suggestedEmployeeId: bestId, suggestedScore: bestScore }
      : { suggestedEmployeeId: null, suggestedScore: null };

  if (!mappedEmployee) {
    return { verdict: 'NO_EMPLOYEE_TO_CHECK', score: null, ...suggestion };
  }

  const { score, weakest } = compareNames(sourceName, employeeFullName(mappedEmployee));
  // A MATCH needs a good average AND no weak link: one shaky token is enough to
  // turn this into a question rather than a pass.
  const verdict: IdentityVerdict =
    score >= MATCH_THRESHOLD && weakest >= WEAKEST_TOKEN_FLOOR
      ? 'MATCH'
      : score < MISMATCH_THRESHOLD
        ? 'MISMATCH'
        : 'UNCERTAIN';

  // When the mapping is trusted, a suggestion pointing elsewhere is noise.
  if (verdict === 'MATCH') {
    return { verdict, score, suggestedEmployeeId: null, suggestedScore: null };
  }
  return { verdict, score, ...suggestion };
}

/** The review flag a verdict earns, or null when the row needs no flag. */
export function flagForVerdict(verdict: IdentityVerdict): string | null {
  switch (verdict) {
    case 'MISMATCH':
    case 'UNCERTAIN':
      return 'IDENTITY_NAME_MISMATCH';
    case 'NO_NAME_IN_SOURCE':
      // Nothing to check is not the same as a failed check. The mapping is still
      // by code, which is authoritative; holding every row would be noise.
      return null;
    case 'MATCH':
    case 'NO_EMPLOYEE_TO_CHECK':
    default:
      return null;
  }
}
