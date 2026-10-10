/**
 * Emergency contacts (up to three) and other government IDs (any number) — the
 * shapes the API stores as rows, plus the conversions for older records and
 * onboarding drafts saved before these became lists.
 */

export const MAX_EMERGENCY_CONTACTS = 3;

export interface EmergencyContactRow {
  contactName: string;
  relationship: string;
  mobilePhone: string;
}

export interface GovernmentIdRow {
  idType: string;
  idNumber: string;
}

export const emptyContact = (): EmergencyContactRow => ({ contactName: "", relationship: "", mobilePhone: "" });
export const emptyGovernmentId = (): GovernmentIdRow => ({ idType: "", idNumber: "" });

const isBlankContact = (c: EmergencyContactRow) => !c.contactName.trim() && !c.relationship.trim() && !c.mobilePhone.trim();

/** The employee's contacts as rows; falls back to the single legacy contact. */
export function contactsFromEmployee(employee: any): EmergencyContactRow[] {
  const rows: EmergencyContactRow[] = Array.isArray(employee?.emergencyContacts)
    ? employee.emergencyContacts.map((c: any) => ({
        contactName: c.contactName ?? "",
        relationship: c.relationship ?? "",
        mobilePhone: c.mobilePhone ?? "",
      }))
    : [];
  if (rows.length) return rows;
  if (employee?.emergencyContactName || employee?.emergencyContactPhone) {
    return [{
      contactName: employee.emergencyContactName ?? "",
      relationship: employee.emergencyContactRel ?? "",
      mobilePhone: employee.emergencyContactPhone ?? "",
    }];
  }
  return [emptyContact()];
}

export function governmentIdsFromEmployee(employee: any): GovernmentIdRow[] {
  return Array.isArray(employee?.governmentIds)
    ? employee.governmentIds.map((g: any) => ({ idType: g.idType ?? "", idNumber: g.idNumber ?? "" }))
    : [];
}

/**
 * Reads the old free-text "Label: number" lines into rows. A line without a
 * colon keeps its text as the number with the type left blank, for HR to fill
 * in — nothing is guessed and nothing is dropped.
 */
export function parseLegacyGovernmentIds(text?: string | null): GovernmentIdRow[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0
        ? { idType: line.slice(0, i).trim(), idNumber: line.slice(i + 1).trim() }
        : { idType: "", idNumber: line };
    });
}

/** Problems with the contacts as entered, or an empty list when they are fine. */
export function contactProblems(contacts: EmergencyContactRow[]): string[] {
  const problems: string[] = [];
  if (!contacts.length || isBlankContact(contacts[0])) problems.push("Emergency contact 1 is required");
  contacts.forEach((c, i) => {
    if (isBlankContact(c)) return;
    const missing = [!c.contactName.trim() && "contact person", !c.relationship.trim() && "relationship", !c.mobilePhone.trim() && "mobile number"].filter(Boolean);
    if (missing.length) problems.push(`Emergency contact ${i + 1}: ${missing.join(", ")}`);
  });
  return problems;
}

export function governmentIdProblems(rows: GovernmentIdRow[]): string[] {
  return rows
    .map((r, i) => {
      if (!r.idType.trim() && !r.idNumber.trim()) return null;
      if (!r.idType.trim()) return `Other government ID ${i + 1}: ID type`;
      if (!r.idNumber.trim()) return `Other government ID ${i + 1}: ID number`;
      return null;
    })
    .filter((p): p is string => !!p);
}

/** Rows with something in them — blank rows are not sent. */
export const filledContacts = (rows: EmergencyContactRow[]) => rows.filter((c) => !isBlankContact(c));
export const filledGovernmentIds = (rows: GovernmentIdRow[]) => rows.filter((r) => r.idType.trim() || r.idNumber.trim());

/**
 * Onboarding drafts saved before contacts and IDs became lists, or before the
 * personal email became the login, are brought into the current shape. The
 * values themselves are carried over unchanged.
 */
export function upgradeDraftData(d: any): any {
  if (!d || typeof d !== "object") return d;
  const out = { ...d };
  // A draft converted from a hired applicant stores what the applicant left
  // out as null (middle name, suffix, department). Blank, not null, so every
  // field stays a controlled input and nothing reads "null".
  for (const key of Object.keys(out)) if (out[key] === null) out[key] = "";
  // Applicants are never asked their sex or civil status. A draft without
  // them opens blank for HR to choose — never the form's "Male" / "Single".
  if (!("gender" in out)) out.gender = "";
  if (!("civilStatus" in out)) out.civilStatus = "";
  if (!Array.isArray(out.emergencyContacts)) {
    const legacy = { contactName: out.emergencyContactName ?? "", relationship: out.emergencyContactRel ?? "", mobilePhone: out.emergencyContactPhone ?? "" };
    out.emergencyContacts = [legacy];
  }
  delete out.emergencyContactName;
  delete out.emergencyContactRel;
  delete out.emergencyContactPhone;
  if (!Array.isArray(out.otherGovernmentIdRows)) {
    out.otherGovernmentIdRows = parseLegacyGovernmentIds(typeof out.otherGovernmentIds === "string" ? out.otherGovernmentIds : "");
  }
  delete out.otherGovernmentIds;
  // The work email is gone: a draft that only had one keeps it as the personal
  // (login) email rather than losing it.
  if (!String(out.personalEmail ?? "").trim() && String(out.workEmail ?? "").trim()) {
    out.personalEmail = out.workEmail;
  }
  delete out.workEmail;
  return out;
}
