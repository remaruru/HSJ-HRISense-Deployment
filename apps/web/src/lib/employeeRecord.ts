/**
 * The optional fields from Hospicio's employee record — personal details, HSJ
 * residence, PRC dates, TESDA national certificate and education. Shared by the
 * onboarding wizard, the HR edit form and both profile screens.
 *
 * Every field is optional. A blank answer stays blank (null on the server);
 * nothing is ever filled with "N/A", "None" or 0. The server enforces the same
 * rules (apps/api/src/lib/employee-record-fields.ts).
 */

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Form keys, all held as strings in the forms ("" = not provided). */
export const RECORD_FIELD_DEFAULTS = {
  bloodType: "",
  spouseName: "",
  numberOfChildren: "",
  hsjResidence: "",
  residenceDorm: "",
  prcIssuedDate: "",
  prcValidUntil: "",
  ncCertificateNumber: "",
  ncQualification: "",
  ncValidUntil: "",
  primarySchool: "",
  secondarySchool: "",
  tertiarySchool: "",
  tertiaryCourse: "",
  /** "" (not recorded), "true" or "false". */
  tertiaryGraduated: "",
  diploma: "",
  vocationalQualification: "",
};
export type RecordFieldKey = keyof typeof RECORD_FIELD_DEFAULTS;
export const RECORD_FIELD_KEYS = Object.keys(RECORD_FIELD_DEFAULTS) as RecordFieldKey[];
export const RECORD_DATE_KEYS: RecordFieldKey[] = ["prcIssuedDate", "prcValidUntil", "ncValidUntil"];

export const RECORD_FIELD_LABELS: Record<RecordFieldKey, string> = {
  bloodType: "Blood type",
  spouseName: "Spouse name",
  numberOfChildren: "Number of children",
  hsjResidence: "HSJ residence",
  residenceDorm: "Unit / dorm",
  prcIssuedDate: "PRC issued date",
  prcValidUntil: "PRC valid until",
  ncCertificateNumber: "NC certificate number",
  ncQualification: "NC qualification",
  ncValidUntil: "NC valid until",
  primarySchool: "Primary school",
  secondarySchool: "Secondary school",
  tertiarySchool: "Tertiary school",
  tertiaryCourse: "Course",
  tertiaryGraduated: "Graduated",
  diploma: "Diploma",
  vocationalQualification: "Vocational qualification",
};

const day = (v: unknown): string => {
  if (!v) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
};

/** Form values from a stored employee. */
export function recordFieldsFromEmployee(emp: any): Record<RecordFieldKey, string> {
  const out = { ...RECORD_FIELD_DEFAULTS } as Record<RecordFieldKey, string>;
  if (!emp) return out;
  for (const key of RECORD_FIELD_KEYS) {
    const v = emp[key];
    if (v === null || v === undefined) continue;
    if (RECORD_DATE_KEYS.includes(key)) out[key] = day(v);
    else if (key === "tertiaryGraduated") out[key] = v === true ? "true" : v === false ? "false" : "";
    else out[key] = String(v);
  }
  return out;
}

/**
 * Dependent values that no longer apply once a field changes. Returns the
 * extra changes to apply ({} when none): Single clears the spouse name; removing
 * a PRC or NC number clears the dates that belong to it.
 */
export function recordFieldCascade(name: string, value: string): Partial<Record<RecordFieldKey, string>> {
  if (name === "civilStatus" && value === "SINGLE") return { spouseName: "" };
  if (name === "prcLicenseNumber" && !value.trim()) return { prcIssuedDate: "", prcValidUntil: "" };
  if (name === "ncCertificateNumber" && !value.trim()) return { ncValidUntil: "" };
  return {};
}

/** The same conditional rules the server applies, as field → message. */
export function recordFieldErrors(f: Record<string, any>): Partial<Record<RecordFieldKey, string>> {
  const errors: Partial<Record<RecordFieldKey, string>> = {};
  const has = (k: string) => String(f[k] ?? "").trim() !== "";
  const children = String(f.numberOfChildren ?? "").trim();
  if (children && !(/^\d+$/.test(children) && Number(children) <= 30)) {
    errors.numberOfChildren = "Enter a whole number from 0 to 30, or leave it blank.";
  }
  if ((has("prcIssuedDate") || has("prcValidUntil")) && !has("prcLicenseNumber")) {
    errors.prcIssuedDate = "Enter the PRC license number first.";
  }
  if (has("prcIssuedDate") && has("prcValidUntil") && f.prcValidUntil < f.prcIssuedDate) {
    errors.prcValidUntil = "Valid until cannot be before the issued date.";
  }
  if (has("ncValidUntil") && !has("ncCertificateNumber")) {
    errors.ncValidUntil = "Enter the certificate number first.";
  }
  if (has("spouseName") && f.civilStatus === "SINGLE") {
    errors.spouseName = "Spouse name applies only when civil status is not Single.";
  }
  return errors;
}

/** Days before expiry when a license or certificate counts as expiring soon. */
export const EXPIRING_SOON_DAYS = 90;

/**
 * Validity of a license or certificate, derived from its valid-until date —
 * never stored. Null when there is no date.
 */
export function credentialValidity(
  validUntil: unknown,
  today: Date = new Date()
): { label: string; tone: "success" | "warning" | "danger" } | null {
  const d = day(validUntil);
  if (!d) return null;
  const [y, m, dd] = d.split("-").map(Number);
  const end = new Date(y, m - 1, dd);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (daysLeft < 0) return { label: "Expired", tone: "danger" };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { label: `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, tone: "warning" };
  return { label: "Valid", tone: "success" };
}

export function graduatedLabel(v: unknown): string | null {
  if (v === true || v === "true") return "Yes";
  if (v === false || v === "false") return "No";
  return null;
}
