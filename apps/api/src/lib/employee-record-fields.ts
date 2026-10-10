import { AppError } from '../middleware/errorHandler';

/**
 * The optional fields from Hospicio's employee record (personal details, HSJ
 * residence, PRC dates, TESDA national certificate, education).
 *
 * Every one is optional. A blank answer is stored as NULL — never a placeholder
 * such as "N/A", "None" or 0 — so "not provided" and "not applicable" are never
 * turned into fake data. Age and length of service are computed elsewhere and
 * are not part of this list.
 *
 * `normalizeRecordFields` cleans the values that are present in `data` (absent
 * keys are left absent, so a partial edit does not clear anything) and checks
 * the conditional rules against the merged result (`existing` + `data`).
 */

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Text fields and their column lengths. */
const TEXT_FIELDS: Record<string, { label: string; max: number }> = {
  spouseName: { label: 'Spouse name', max: 150 },
  hsjResidence: { label: 'HSJ residence', max: 150 },
  residenceDorm: { label: 'Unit / dorm', max: 100 },
  ncCertificateNumber: { label: 'NC certificate number', max: 50 },
  ncQualification: { label: 'NC qualification', max: 150 },
  primarySchool: { label: 'Primary school', max: 150 },
  secondarySchool: { label: 'Secondary school', max: 150 },
  tertiarySchool: { label: 'Tertiary school', max: 150 },
  tertiaryCourse: { label: 'Course', max: 150 },
  diploma: { label: 'Diploma', max: 150 },
  vocationalQualification: { label: 'Vocational qualification', max: 150 },
};

const DATE_FIELDS: Record<string, string> = {
  prcIssuedDate: 'PRC issued date',
  prcValidUntil: 'PRC valid until',
  ncValidUntil: 'NC valid until',
};

/** Every field this module owns, for callers that copy them onto a record. */
export const RECORD_FIELD_KEYS = [
  'bloodType',
  'numberOfChildren',
  'tertiaryGraduated',
  ...Object.keys(TEXT_FIELDS),
  ...Object.keys(DATE_FIELDS),
] as const;

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function toDate(value: unknown, label: string): Date | null {
  if (isBlank(value)) return null;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError(`${label} is not a valid date.`, 400, undefined, 'VALIDATION_ERROR');
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    throw new AppError(`${label} is not a valid date.`, 400, undefined, 'VALIDATION_ERROR');
  }
  return d;
}

/**
 * Cleans the record fields present in `data`, in place, and validates the
 * conditional rules. `existing` is the stored employee for an edit.
 */
export function normalizeRecordFields(data: Record<string, any>, existing?: Record<string, any> | null): void {
  for (const [key, { label, max }] of Object.entries(TEXT_FIELDS)) {
    if (!(key in data)) continue;
    const value = isBlank(data[key]) ? null : String(data[key]).trim();
    if (value && value.length > max) {
      throw new AppError(`${label} must be ${max} characters or fewer.`, 400, undefined, 'VALIDATION_ERROR');
    }
    data[key] = value;
  }

  if ('bloodType' in data) {
    const value = isBlank(data.bloodType) ? null : String(data.bloodType).trim().toUpperCase();
    if (value && !(BLOOD_TYPES as readonly string[]).includes(value)) {
      throw new AppError(`Blood type must be one of ${BLOOD_TYPES.join(', ')}, or left blank.`, 400, undefined, 'VALIDATION_ERROR');
    }
    data.bloodType = value;
  }

  if ('numberOfChildren' in data) {
    if (isBlank(data.numberOfChildren)) {
      data.numberOfChildren = null;
    } else {
      const n = Number(data.numberOfChildren);
      if (!Number.isInteger(n) || n < 0 || n > 30) {
        throw new AppError('Number of children must be a whole number from 0 to 30, or left blank.', 400, undefined, 'VALIDATION_ERROR');
      }
      data.numberOfChildren = n;
    }
  }

  if ('tertiaryGraduated' in data) {
    const v = data.tertiaryGraduated;
    data.tertiaryGraduated = v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
  }

  for (const [key, label] of Object.entries(DATE_FIELDS)) {
    if (key in data) data[key] = toDate(data[key], label);
  }

  // ── Conditional rules, on the record as it will be saved ─────────────────
  const merged = { ...(existing ?? {}), ...data };
  const has = (k: string) => !isBlank(merged[k]);

  if ((has('prcIssuedDate') || has('prcValidUntil')) && !has('prcLicenseNumber')) {
    throw new AppError('Enter the PRC license number to record its issued and valid-until dates.', 400, undefined, 'VALIDATION_ERROR');
  }
  if (has('prcIssuedDate') && has('prcValidUntil') && new Date(merged.prcValidUntil) < new Date(merged.prcIssuedDate)) {
    throw new AppError('PRC valid-until date cannot be before its issued date.', 400, undefined, 'VALIDATION_ERROR');
  }
  if (has('ncValidUntil') && !has('ncCertificateNumber')) {
    throw new AppError('Enter the NC certificate number to record its validity date.', 400, undefined, 'VALIDATION_ERROR');
  }
  if (has('spouseName') && merged.civilStatus === 'SINGLE') {
    throw new AppError('Spouse name applies only when civil status is not Single. Clear it or change the civil status.', 400, undefined, 'VALIDATION_ERROR');
  }
}

/** The cleaned record fields, for a create — absent ones become null. */
export function recordFieldsForCreate(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of RECORD_FIELD_KEYS) out[key] = key in data ? data[key] : null;
  return out;
}
