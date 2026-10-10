import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Emergency contacts (up to three) and other government IDs (any number), as
 * rows — plus the one rule for the employee / login email.
 *
 * Emergency contact #1 is required and is mirrored into the legacy
 * `employees.emergencyContactName / Rel / Phone` columns, which the directory,
 * exports, profile completion and the assistant still read.
 */

export const MAX_EMERGENCY_CONTACTS = 3;

export interface EmergencyContactInput {
  contactName: string;
  relationship: string;
  mobilePhone: string;
}

export interface GovernmentIdInput {
  idType: string;
  idNumber: string;
}

type Db = Prisma.TransactionClient | typeof prisma;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim());

/** An array from a JSON body or a multipart field (sent as a JSON string). Undefined when absent. */
export function readList(raw: unknown): any[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  throw new AppError('A list field was not in the expected format.', 400);
}

/**
 * Validated emergency contacts. Blank rows are ignored; a partly filled row is
 * an error (every contact needs a person, relationship and mobile number).
 * Falls back to the legacy single-contact fields when no list was sent, so an
 * older client keeps working.
 */
export function normalizeEmergencyContacts(
  raw: unknown,
  legacy?: { emergencyContactName?: unknown; emergencyContactRel?: unknown; emergencyContactPhone?: unknown }
): EmergencyContactInput[] | undefined {
  let list = readList(raw);
  if (list === undefined && legacy && [legacy.emergencyContactName, legacy.emergencyContactRel, legacy.emergencyContactPhone].some((v) => v !== undefined)) {
    list = [{ contactName: legacy.emergencyContactName, relationship: legacy.emergencyContactRel, mobilePhone: legacy.emergencyContactPhone }];
  }
  if (list === undefined) return undefined;

  const rows = list
    .map((r: any) => ({ contactName: clean(r?.contactName), relationship: clean(r?.relationship), mobilePhone: clean(r?.mobilePhone) }))
    .filter((r) => r.contactName || r.relationship || r.mobilePhone);

  if (rows.length > MAX_EMERGENCY_CONTACTS) {
    throw new AppError(`An employee can have at most ${MAX_EMERGENCY_CONTACTS} emergency contacts.`, 400);
  }
  rows.forEach((r, i) => {
    const missing = [!r.contactName && 'contact person', !r.relationship && 'relationship', !r.mobilePhone && 'mobile number'].filter(Boolean);
    if (missing.length) throw new AppError(`Emergency contact ${i + 1} is missing: ${missing.join(', ')}.`, 400);
    if (r.contactName.length > 191 || r.relationship.length > 191 || r.mobilePhone.length > 191) {
      throw new AppError(`Emergency contact ${i + 1} has a value that is too long.`, 400);
    }
  });
  return rows;
}

/** Validated government ID rows; blank rows ignored, both parts required otherwise. */
export function normalizeGovernmentIds(raw: unknown): GovernmentIdInput[] | undefined {
  const list = readList(raw);
  if (list === undefined) return undefined;
  const rows = list
    .map((r: any) => ({ idType: clean(r?.idType), idNumber: clean(r?.idNumber) }))
    .filter((r) => r.idType || r.idNumber);
  rows.forEach((r, i) => {
    if (!r.idType || !r.idNumber) {
      throw new AppError(`Other government ID ${i + 1} needs both the ID type and the ID number.`, 400);
    }
    if (r.idType.length > 120 || r.idNumber.length > 120) {
      throw new AppError(`Other government ID ${i + 1} is too long (120 characters at most).`, 400);
    }
  });
  return rows;
}

/** Replaces an employee's contacts; returns the legacy-column mirror of contact #1. */
export async function writeEmergencyContacts(db: Db, employeeId: string, contacts: EmergencyContactInput[]) {
  await db.employeeEmergencyContact.deleteMany({ where: { employeeId } });
  if (contacts.length) {
    await db.employeeEmergencyContact.createMany({
      data: contacts.map((c, i) => ({ employeeId, position: i + 1, ...c })),
    });
  }
  const first = contacts[0];
  return first
    ? { emergencyContactName: first.contactName, emergencyContactRel: first.relationship, emergencyContactPhone: first.mobilePhone }
    : null;
}

export async function writeGovernmentIds(db: Db, employeeId: string, rows: GovernmentIdInput[]) {
  await db.employeeGovernmentId.deleteMany({ where: { employeeId } });
  if (rows.length) {
    await db.employeeGovernmentId.createMany({
      data: rows.map((r, i) => ({ employeeId, position: i + 1, ...r })),
    });
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The personal email, which is also the login email. Throws when invalid. */
export function normalizeLoginEmail(raw: unknown): string | null {
  const email = clean(raw);
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 191) {
    throw new AppError('Please enter a valid personal email address — it is also the HRISense login.', 400);
  }
  return email;
}

/**
 * The personal email may not be anyone else's login or personal email. Case is
 * ignored by the database's collation, so "Ana@x" and "ana@x" collide here too.
 */
export async function assertLoginEmailAvailable(email: string, employeeId?: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { employeeId: true } });
  if (user && user.employeeId !== employeeId) {
    throw new AppError('This email address is already the login of another HRISense account.', 409);
  }
  const other = await prisma.employee.findFirst({
    where: { personalEmail: email, ...(employeeId ? { NOT: { id: employeeId } } : {}) },
    select: { employeeNumber: true },
  });
  if (other) {
    throw new AppError(`This email address is already recorded for employee ${other.employeeNumber}.`, 409);
  }
}
