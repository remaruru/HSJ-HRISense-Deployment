import { EmploymentState } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { createAuditLog } from '../lib/audit';
import { AppError } from '../middleware/errorHandler';

/**
 * The official HR office contact: the one way to reach HR that HRISense may
 * give to everybody. HR records it in Settings; AI Assistance reads it.
 *
 * It exists so nobody has to share an HR person's own details: their mobile
 * number and personal email (which is also their sign-in) stay private.
 */

const KEYS = {
  phone: { key: 'hr_contact.phone', description: 'HR office phone number shared with all staff' },
  email: { key: 'hr_contact.email', description: 'HR office email shared with all staff' },
  location: { key: 'hr_contact.location', description: 'Where the HR office is, shared with all staff' },
} as const;

export interface HrContact {
  phone: string | null;
  email: string | null;
  location: string | null;
}

const hrContactSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(40, 'Enter a phone number of up to 40 characters.')
      .regex(/^[0-9+()\-./,\s]*((loc|local|ext)\.?\s*[0-9]+)?$/i, 'Enter a phone number using digits, spaces and + ( ) - . / only.'),
    email: z
      .string()
      .trim()
      .max(120, 'Enter an email of up to 120 characters.')
      .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address.'),
    location: z.string().trim().max(120, 'Enter a location of up to 120 characters.'),
  })
  .strict();

/** The validated, trimmed form values. An empty value clears that field. */
export function parseHrContact(raw: unknown): { phone: string; email: string; location: string } {
  const parsed = hrContactSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? 'Check the HR office contact details.', 400);
  return parsed.data;
}

/** The job roles people mean by "HR". The Sister oversees HR but is not its contact point. */
const HR_CONTACT_ROLE_CODES = ['HR_OFFICER', 'HR_ASSISTANT'];

export class HrContactService {
  /** What anyone may be told about reaching HR: the office contact, and HR staff names and job roles only. */
  static async directory() {
    const [office, staff] = await Promise.all([
      HrContactService.get(),
      prisma.employee.findMany({
        where: {
          deletedAt: null,
          employmentState: { notIn: [EmploymentState.RESIGNED, EmploymentState.TERMINATED, EmploymentState.RETIRED] },
          jobRole: { code: { in: HR_CONTACT_ROLE_CODES } },
        },
        take: 10,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: { firstName: true, lastName: true, jobRole: { select: { title: true } } },
      }),
    ]);
    return {
      office,
      staff: staff.map((e) => ({ name: `${e.firstName} ${e.lastName}`.trim(), jobRole: e.jobRole?.title ?? null })),
    };
  }

  static async get(): Promise<HrContact> {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: Object.values(KEYS).map((k) => k.key) } },
      select: { key: true, value: true },
    });
    const value = (key: string) => rows.find((r) => r.key === key)?.value || null;
    return { phone: value(KEYS.phone.key), email: value(KEYS.email.key), location: value(KEYS.location.key) };
  }

  static async update(raw: unknown, actorUserId: string): Promise<HrContact> {
    const input = parseHrContact(raw);
    const before = await HrContactService.get();
    await prisma.$transaction(
      (Object.keys(KEYS) as Array<keyof typeof KEYS>).map((field) =>
        prisma.systemSetting.upsert({
          where: { key: KEYS[field].key },
          create: { key: KEYS[field].key, value: input[field], description: KEYS[field].description, updatedById: actorUserId },
          update: { value: input[field], updatedById: actorUserId },
        })
      )
    );
    const after = await HrContactService.get();
    await createAuditLog({ actorUserId, action: 'HR_CONTACT_UPDATED', entityType: 'SystemSetting', oldValue: before, newValue: after });
    return after;
  }
}
