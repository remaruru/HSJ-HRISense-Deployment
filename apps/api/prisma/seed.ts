/**
 * HRISense — Prisma Seed Script
 * Seeds all Units, JobRoles, Permissions, RolePermissions,
 * demo Users, and sample Employees/data for HSJ.
 *
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient, PermissionTier, Gender, CivilStatus, EmploymentStatus, LeaveType, AttendanceStatus, TrainingStatus, AnnouncementPriority, AnnouncementAudience, RequirementCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Strong random password for locally seeded accounts.
 * Seeds must never bake in a weak, production-shaped credential.
 */
function generateSeedPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";
  const all = upper + lower + digits + symbols;

  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];
  for (let i = chars.length; i < length; i++) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
// Local sample-staff password. Override with SEED_DEFAULT_PASSWORD; the fallback
// is generated so the seed never bakes in a fixed, production-shaped credential.
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || generateSeedPassword();

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const UNITS = [
  { name: "Human Resource Department", code: "HRD", description: "Manages all HR functions for Hospicio de San Jose" },
  { name: "Administrative Services", code: "ADM", description: "Handles administrative and secretarial functions" },
  { name: "Finance", code: "FIN", description: "Manages financial operations, accounting, and procurement" },
  { name: "General Support Services", code: "GSS", description: "Provides kitchen, laundry, janitorial, and maintenance services" },
  { name: "Auxiliary Services", code: "AUX", description: "Operates income-generating programs and auxiliary facilities" },
  { name: "Social Services", code: "SOC", description: "Delivers social welfare programs and psychosocial support" },
  { name: "Pastoral Care / Homelife Services", code: "PCH", description: "Provides pastoral, spiritual, and child/homelife care" },
  { name: "Health Services", code: "HLT", description: "Manages clinic and physical therapy services" },
] as const;

// All 48 job roles from the spreadsheet — exact titles, correct tiers, correct units
const JOB_ROLES: Array<{
  title: string;
  code: string;
  unitCode: string;
  tier: PermissionTier;
}> = [
  // Human Resource Department — FULL tier
  { title: "Human Resource Officer", code: "HR_OFFICER", unitCode: "HRD", tier: "FULL" },
  { title: "Human Resource Assistant/Staff", code: "HR_ASSISTANT", unitCode: "HRD", tier: "FULL" },

  // Administrative Services
  { title: "Assistant Administrator", code: "ASST_ADMIN", unitCode: "ADM", tier: "SUPERVISOR" },
  { title: "Administrative Secretaries", code: "ADMIN_SEC", unitCode: "ADM", tier: "STANDARD" },
  { title: "Receptionists", code: "RECEPTIONIST", unitCode: "ADM", tier: "STANDARD" },

  // Finance
  { title: "Accounting Staff", code: "ACCOUNTING_STAFF", unitCode: "FIN", tier: "STANDARD" },
  { title: "PMO Staff", code: "PMO_STAFF", unitCode: "FIN", tier: "STANDARD" },
  { title: "Liaison Officer", code: "LIAISON_OFFICER", unitCode: "FIN", tier: "STANDARD" },
  { title: "Stockroom Staff", code: "STOCKROOM_STAFF", unitCode: "FIN", tier: "STANDARD" },

  // General Support Services
  { title: "Kitchen Supervisor", code: "KITCHEN_SUPERVISOR", unitCode: "GSS", tier: "SUPERVISOR" },
  { title: "Kitchen Staff", code: "KITCHEN_STAFF", unitCode: "GSS", tier: "STANDARD" },
  { title: "Laundry Staff", code: "LAUNDRY_STAFF", unitCode: "GSS", tier: "STANDARD" },
  { title: "Janitorial Supervisor", code: "JANITORIAL_SUPERVISOR", unitCode: "GSS", tier: "SUPERVISOR" },
  { title: "Janitorial Staff", code: "JANITORIAL_STAFF", unitCode: "GSS", tier: "STANDARD" },
  { title: "Drivers", code: "DRIVER", unitCode: "GSS", tier: "STANDARD" },
  { title: "Maintenance Supervisor", code: "MAINTENANCE_SUPERVISOR", unitCode: "GSS", tier: "SUPERVISOR" },
  { title: "Maintenance Staff", code: "MAINTENANCE_STAFF", unitCode: "GSS", tier: "STANDARD" },

  // Auxiliary Services
  { title: "IGP Coordinator", code: "IGP_COORDINATOR", unitCode: "AUX", tier: "SUPERVISOR" },
  { title: "Canteen Staff", code: "CANTEEN_STAFF", unitCode: "AUX", tier: "STANDARD" },
  { title: "Bakery Staff", code: "BAKERY_STAFF", unitCode: "AUX", tier: "STANDARD" },
  { title: "Dormitory Staff", code: "DORMITORY_STAFF", unitCode: "AUX", tier: "STANDARD" },

  // Social Services
  { title: "Head SSD", code: "HEAD_SSD", unitCode: "SOC", tier: "SUPERVISOR" },
  { title: "Social Workers", code: "SOCIAL_WORKER", unitCode: "SOC", tier: "STANDARD" },
  { title: "Psychologist", code: "PSYCHOLOGIST", unitCode: "SOC", tier: "STANDARD" },
  { title: "ECCD Teacher", code: "ECCD_TEACHER", unitCode: "SOC", tier: "STANDARD" },
  { title: "Part-Time Psychologist", code: "PT_PSYCHOLOGIST", unitCode: "SOC", tier: "STANDARD" },

  // Pastoral Care / Homelife Services
  { title: "Head Pastoral Care/Homelife Services", code: "HEAD_PCH", unitCode: "PCH", tier: "SUPERVISOR" },
  { title: "Chapel Staff", code: "CHAPEL_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "CY Coordinator", code: "CY_COORDINATOR", unitCode: "PCH", tier: "SUPERVISOR" },
  { title: "Pre-School Staff", code: "PRE_SCHOOL_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "St. Mary Staff", code: "ST_MARY_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "St. Joseph Staff", code: "ST_JOSEPH_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "PSN Coordinator", code: "PSN_COORDINATOR", unitCode: "PCH", tier: "SUPERVISOR" },
  { title: "Rendu A Staff", code: "RENDU_A_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "Rendu B Staff", code: "RENDU_B_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "Rendu C Staff", code: "RENDU_C_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "OP Coordinator", code: "OP_COORDINATOR", unitCode: "PCH", tier: "SUPERVISOR" },
  { title: "Sta. Luisa Staff", code: "STA_LUISA_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "St. Vincent Staff", code: "ST_VINCENT_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "CIP Coordinator", code: "CIP_COORDINATOR", unitCode: "PCH", tier: "SUPERVISOR" },
  { title: "Tahan Center Staff", code: "TAHAN_CENTER_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "Sanctuary Center Staff", code: "SANCTUARY_CENTER_STAFF", unitCode: "PCH", tier: "STANDARD" },
  { title: "Sigliv Boys Staff", code: "SIGLIV_BOYS_STAFF", unitCode: "PCH", tier: "STANDARD" },

  // Health Services
  { title: "Clinic Staff", code: "CLINIC_STAFF", unitCode: "HLT", tier: "SUPERVISOR" },
  { title: "PT Coordinator", code: "PT_COORDINATOR", unitCode: "HLT", tier: "SUPERVISOR" },
  { title: "PT Staff", code: "PT_STAFF", unitCode: "HLT", tier: "STANDARD" },
];

// ─── Permission definitions ───────────────────────────────────────────────────
// Derived from the spreadsheet's "ACCESS TO" column — 3 tiers mapped to granular permissions
const PERMISSIONS: Array<{ module: string; action: string; scope: string; description: string }> = [
  // ── OWN (All Tiers) ──
  { module: "profile", action: "read", scope: "OWN", description: "View own employee profile" },
  { module: "profile", action: "update", scope: "OWN", description: "Edit own profile details" },
  { module: "leave", action: "read", scope: "OWN", description: "View own leave requests and balances" },
  { module: "leave", action: "create", scope: "OWN", description: "File own leave requests" },
  { module: "leave", action: "cancel", scope: "OWN", description: "Cancel own leave requests" },
  { module: "training", action: "read", scope: "OWN", description: "View own training/seminar attendance records" },
  { module: "psychological", action: "read", scope: "OWN", description: "View own psychological assessment results" },
  { module: "attendance", action: "read", scope: "OWN", description: "View own attendance records" },
  { module: "announcement", action: "read", scope: "OWN", description: "View announcements addressed to own role/unit" },
  { module: "notification", action: "read", scope: "OWN", description: "View own notifications" },
  { module: "notification", action: "update", scope: "OWN", description: "Mark own notifications as read" },
  { module: "activity", action: "read", scope: "OWN", description: "View own activity attendance records" },

  // ── SUBORDINATES (Supervisor + Full Tier) ──
  { module: "attendance", action: "read", scope: "SUBORDINATES", description: "View attendance records of supervised staff" },
  { module: "attendance_log", action: "read", scope: "SUBORDINATES", description: "View late/tardiness/excuse slip logs of supervised staff" },
  { module: "activity", action: "read", scope: "SUBORDINATES", description: "View activity attendance of supervised staff" },
  { module: "attendance_log", action: "update", scope: "SUBORDINATES", description: "Acknowledge late/tardiness logs for supervised staff" },

  // ── ALL (Full Tier Only — HR Officers) ──
  { module: "employee", action: "read", scope: "ALL", description: "View all employee profiles and records" },
  { module: "employee", action: "create", scope: "ALL", description: "Add new employees to the system" },
  { module: "employee", action: "update", scope: "ALL", description: "Edit any employee's information" },
  { module: "employee", action: "delete", scope: "ALL", description: "Soft-delete employee records" },
  { module: "leave", action: "read", scope: "ALL", description: "View all leave requests institution-wide" },
  { module: "leave", action: "approve", scope: "ALL", description: "Approve leave requests" },
  { module: "leave", action: "reject", scope: "ALL", description: "Reject leave requests with reason" },
  { module: "leave", action: "update", scope: "ALL", description: "Edit any leave record" },
  { module: "attendance", action: "read", scope: "ALL", description: "View attendance records institution-wide" },
  { module: "attendance", action: "update", scope: "ALL", description: "Edit/correct attendance records" },
  { module: "attendance_log", action: "read", scope: "ALL", description: "View all attendance logs institution-wide" },
  { module: "attendance_log", action: "create", scope: "ALL", description: "Log tardiness/overtime entries" },
  { module: "training", action: "read", scope: "ALL", description: "View all training records and programs" },
  { module: "training", action: "create", scope: "ALL", description: "Create training/seminar programs" },
  { module: "training", action: "update", scope: "ALL", description: "Edit training programs and attendee records" },
  { module: "training", action: "delete", scope: "ALL", description: "Cancel or remove training programs" },
  { module: "psychological", action: "read", scope: "ALL", description: "View all psychological records" },
  { module: "psychological", action: "create", scope: "ALL", description: "Create psychological assessment records" },
  { module: "psychological", action: "update", scope: "ALL", description: "Update psychological records" },
  { module: "medical", action: "read", scope: "ALL", description: "View all medical records" },
  { module: "medical", action: "create", scope: "ALL", description: "Create medical records" },
  { module: "medical", action: "update", scope: "ALL", description: "Update medical records" },
  { module: "activity", action: "read", scope: "ALL", description: "View all activity attendance records" },
  { module: "activity", action: "create", scope: "ALL", description: "Create activity attendance entries" },
  { module: "performance", action: "read", scope: "ALL", description: "View all performance evaluations" },
  { module: "performance", action: "create", scope: "ALL", description: "Create performance evaluations" },
  { module: "performance", action: "update", scope: "ALL", description: "Edit performance evaluations" },
  { module: "compliance", action: "read", scope: "ALL", description: "View all compliance requirements" },
  { module: "compliance", action: "create", scope: "ALL", description: "Add compliance requirements" },
  { module: "compliance", action: "update", scope: "ALL", description: "Update compliance status and details" },
  { module: "announcement", action: "create", scope: "ALL", description: "Post announcements institution-wide" },
  { module: "announcement", action: "update", scope: "ALL", description: "Edit or pin announcements" },
  { module: "announcement", action: "delete", scope: "ALL", description: "Remove announcements" },
  { module: "ai", action: "read", scope: "ALL", description: "View AI workforce intelligence insights" },
  { module: "ai", action: "create", scope: "ALL", description: "Generate AI insights and summaries" },
  { module: "reports", action: "read", scope: "ALL", description: "Access analytics and reports dashboards" },
  { module: "reports", action: "export", scope: "ALL", description: "Export reports to PDF/CSV" },
  { module: "users", action: "manage", scope: "ALL", description: "Manage user accounts and access" },
  { module: "audit", action: "read", scope: "ALL", description: "View system audit logs" },
  { module: "settings", action: "manage", scope: "ALL", description: "Manage system settings" },
  { module: "document", action: "read", scope: "ALL", description: "View all employee documents" },
  { module: "document", action: "create", scope: "ALL", description: "Upload documents for any employee" },
];

// ─── Which permission keys apply to which tier ────────────────────────────────
const FULL_PERMISSIONS = PERMISSIONS.map((p) => `${p.module}.${p.action}.${p.scope}`);

const SUPERVISOR_PERMISSIONS = PERMISSIONS
  .filter((p) => p.scope === "OWN" || p.scope === "SUBORDINATES")
  .map((p) => `${p.module}.${p.action}.${p.scope}`);

const STANDARD_PERMISSIONS = PERMISSIONS
  .filter((p) => p.scope === "OWN")
  .map((p) => `${p.module}.${p.action}.${p.scope}`);

// ─── Sample Employees (realistic HSJ staff) ───────────────────────────────────
const SAMPLE_EMPLOYEES = [
  // HR Officers
  {
    employeeNumber: "HSJ-001",
    firstName: "Earl", middleName: "", lastName: "Angelo", suffix: null,
    gender: "MALE" as Gender, dateOfBirth: new Date("1980-03-15"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "hr.officer@hsj.org.ph",
    mobilePhone: "09171234561",
    presentAddress: "123 Arlegui St., Quiapo, Manila",
    emergencyContactName: "Roberto Villanueva", emergencyContactRel: "Husband", emergencyContactPhone: "09171234562",
    unitCode: "HRD", roleCode: "HR_OFFICER",
    
    hireDate: new Date("2010-06-01"),
    sssNumber: "33-1234567-8", philhealthNumber: "12-123456789-0", pagibigNumber: "1234-5678-9012", tinNumber: "123-456-789-000",
  },
  {
    employeeNumber: "HSJ-002",
    firstName: "Jose", middleName: "dela", lastName: "Cruz", suffix: "Jr.",
    gender: "MALE" as Gender, dateOfBirth: new Date("1990-07-22"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "hr.assistant@hsj.org.ph",
    mobilePhone: "09182345672",
    presentAddress: "45 Claro M. Recto Ave., Manila",
    emergencyContactName: "Ligaya dela Cruz", emergencyContactRel: "Mother", emergencyContactPhone: "09182345673",
    unitCode: "HRD", roleCode: "HR_ASSISTANT",
    
    hireDate: new Date("2018-01-15"),
    sssNumber: "33-9876543-2", philhealthNumber: "12-987654321-0", pagibigNumber: "9876-5432-1098", tinNumber: "987-654-321-000",
  },

  // Administrative Services
  {
    employeeNumber: "HSJ-003",
    firstName: "Rosario", middleName: "Gomez", lastName: "Reyes", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1975-11-08"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "asst.admin@hsj.org.ph",
    mobilePhone: "09193456783",
    presentAddress: "78 Ayala Blvd., Ermita, Manila",
    emergencyContactName: "Eduardo Reyes", emergencyContactRel: "Husband", emergencyContactPhone: "09193456784",
    unitCode: "ADM", roleCode: "ASST_ADMIN",
    
    hireDate: new Date("2005-04-10"),
    sssNumber: "33-5555555-5", philhealthNumber: "12-555555555-0", pagibigNumber: "5555-5555-5555", tinNumber: "555-555-555-000",
  },
  {
    employeeNumber: "HSJ-004",
    firstName: "Ana", middleName: null, lastName: "Bautista", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1995-04-18"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "admin.sec@hsj.org.ph",
    mobilePhone: "09204567894",
    presentAddress: "12 Escolta St., Binondo, Manila",
    emergencyContactName: "Carina Bautista", emergencyContactRel: "Mother", emergencyContactPhone: "09204567895",
    unitCode: "ADM", roleCode: "ADMIN_SEC",
    
    hireDate: new Date("2020-08-01"),
    sssNumber: "33-4444444-4", philhealthNumber: "12-444444444-0", pagibigNumber: "4444-4444-4444", tinNumber: "444-444-444-000",
  },

  // Finance
  {
    employeeNumber: "HSJ-005",
    firstName: "Carmelo", middleName: "Santos", lastName: "Ramos", suffix: null,
    gender: "MALE" as Gender, dateOfBirth: new Date("1985-09-30"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "accounting@hsj.org.ph",
    mobilePhone: "09215678905",
    presentAddress: "56 España Blvd., Sampaloc, Manila",
    emergencyContactName: "Luisa Ramos", emergencyContactRel: "Wife", emergencyContactPhone: "09215678906",
    unitCode: "FIN", roleCode: "ACCOUNTING_STAFF",
    
    hireDate: new Date("2012-03-20"),
    sssNumber: "33-3333333-3", philhealthNumber: "12-333333333-0", pagibigNumber: "3333-3333-3333", tinNumber: "333-333-333-000",
  },

  // General Support Services
  {
    employeeNumber: "HSJ-006",
    firstName: "Teresita", middleName: "Lopez", lastName: "Aquino", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1972-01-25"),
    civilStatus: "WIDOWED" as CivilStatus,
    personalEmail: "kitchen.sup@hsj.org.ph",
    mobilePhone: "09226789016",
    presentAddress: "89 G. Tuazon St., Sampaloc, Manila",
    emergencyContactName: "Maricel Aquino", emergencyContactRel: "Daughter", emergencyContactPhone: "09226789017",
    unitCode: "GSS", roleCode: "KITCHEN_SUPERVISOR",
    
    hireDate: new Date("2003-07-12"),
    sssNumber: "33-2222222-2", philhealthNumber: "12-222222222-0", pagibigNumber: "2222-2222-2222", tinNumber: "222-222-222-000",
  },
  {
    employeeNumber: "HSJ-007",
    firstName: "Danilo", middleName: "Castro", lastName: "Mendoza", suffix: null,
    gender: "MALE" as Gender, dateOfBirth: new Date("1988-06-14"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "kitchen.staff1@hsj.org.ph",
    mobilePhone: "09237890127",
    presentAddress: "34 Maypajo, Caloocan City",
    emergencyContactName: "Elena Mendoza", emergencyContactRel: "Wife", emergencyContactPhone: "09237890128",
    unitCode: "GSS", roleCode: "KITCHEN_STAFF",
    
    hireDate: new Date("2015-11-30"),
    sssNumber: "33-1111111-1", philhealthNumber: "12-111111111-0", pagibigNumber: "1111-1111-1111", tinNumber: "111-111-111-000",
  },

  // Social Services
  {
    employeeNumber: "HSJ-008",
    firstName: "Lourdes", middleName: "Garcia", lastName: "Santos", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1979-12-05"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "head.ssd@hsj.org.ph",
    mobilePhone: "09248901238",
    presentAddress: "23 Del Monte Ave., Quezon City",
    emergencyContactName: "Ramon Santos", emergencyContactRel: "Husband", emergencyContactPhone: "09248901239",
    unitCode: "SOC", roleCode: "HEAD_SSD",
    
    hireDate: new Date("2008-09-01"),
    sssNumber: "33-8888888-8", philhealthNumber: "12-888888888-0", pagibigNumber: "8888-8888-8888", tinNumber: "888-888-888-000",
  },
  {
    employeeNumber: "HSJ-009",
    firstName: "Patricia", middleName: "Flores", lastName: "Torres", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1993-08-17"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "social.worker1@hsj.org.ph",
    mobilePhone: "09259012349",
    presentAddress: "67 Aurora Blvd., Cubao, Quezon City",
    emergencyContactName: "Manuel Torres", emergencyContactRel: "Father", emergencyContactPhone: "09259012350",
    unitCode: "SOC", roleCode: "SOCIAL_WORKER",
    
    hireDate: new Date("2019-02-14"),
    sssNumber: "33-7777777-7", philhealthNumber: "12-777777777-0", pagibigNumber: "7777-7777-7777", tinNumber: "777-777-777-000",
  },
  {
    employeeNumber: "HSJ-010",
    firstName: "Cristina", middleName: "dela", lastName: "Rosa", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1986-03-22"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "psychologist@hsj.org.ph",
    mobilePhone: "09260123450",
    presentAddress: "11 Mindanao Ave., Quezon City",
    emergencyContactName: "Fernando dela Rosa", emergencyContactRel: "Husband", emergencyContactPhone: "09260123451",
    unitCode: "SOC", roleCode: "PSYCHOLOGIST",
    
    hireDate: new Date("2014-06-16"),
    sssNumber: "33-6666666-6", philhealthNumber: "12-666666666-0", pagibigNumber: "6666-6666-6666", tinNumber: "666-666-666-000",
  },

  // Pastoral Care / Homelife Services
  {
    employeeNumber: "HSJ-011",
    firstName: "Erlinda", middleName: "Macaraeg", lastName: "Pascual", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1970-05-30"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "head.pch@hsj.org.ph",
    mobilePhone: "09271234561",
    presentAddress: "44 Batangas St., Sta. Mesa, Manila",
    emergencyContactName: "Vicente Pascual", emergencyContactRel: "Husband", emergencyContactPhone: "09271234562",
    unitCode: "PCH", roleCode: "HEAD_PCH",
    
    hireDate: new Date("2001-01-08"),
    sssNumber: "33-9999999-9", philhealthNumber: "12-999999999-0", pagibigNumber: "9999-9999-9999", tinNumber: "999-999-999-000",
  },
  {
    employeeNumber: "HSJ-012",
    firstName: "Natividad", middleName: null, lastName: "Soriano", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1982-10-11"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "chapel.staff@hsj.org.ph",
    mobilePhone: "09282345672",
    presentAddress: "88 Leveriza St., Pasay City",
    emergencyContactName: "Caridad Soriano", emergencyContactRel: "Mother", emergencyContactPhone: "09282345673",
    unitCode: "PCH", roleCode: "CHAPEL_STAFF",
    
    hireDate: new Date("2011-04-25"),
    sssNumber: "33-0101010-1", philhealthNumber: "12-010101010-0", pagibigNumber: "0101-0101-0101", tinNumber: "010-101-010-000",
  },

  // Health Services
  {
    employeeNumber: "HSJ-013",
    firstName: "Remedios", middleName: "Santos", lastName: "Navarro", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1977-07-04"),
    civilStatus: "MARRIED" as CivilStatus,
    personalEmail: "clinic.staff@hsj.org.ph",
    mobilePhone: "09293456783",
    presentAddress: "22 Libertad St., Pasay City",
    emergencyContactName: "Gregorio Navarro", emergencyContactRel: "Husband", emergencyContactPhone: "09293456784",
    unitCode: "HLT", roleCode: "CLINIC_STAFF",
    
    hireDate: new Date("2007-03-19"),
    sssNumber: "33-1212121-2", philhealthNumber: "12-121212121-0", pagibigNumber: "1212-1212-1212", tinNumber: "121-212-121-000",
  },
  {
    employeeNumber: "HSJ-014",
    firstName: "Benjamin", middleName: "Cruz", lastName: "Gonzales", suffix: null,
    gender: "MALE" as Gender, dateOfBirth: new Date("1990-01-19"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "pt.coordinator@hsj.org.ph",
    mobilePhone: "09204567894",
    presentAddress: "33 Buendia Ave., Makati City",
    emergencyContactName: "Norma Gonzales", emergencyContactRel: "Mother", emergencyContactPhone: "09204567895",
    unitCode: "HLT", roleCode: "PT_COORDINATOR",
    
    hireDate: new Date("2016-09-05"),
    sssNumber: "33-3434343-4", philhealthNumber: "12-343434343-0", pagibigNumber: "3434-3434-3434", tinNumber: "343-434-343-000",
  },
  {
    employeeNumber: "HSJ-015",
    firstName: "Marilou", middleName: "Aguilar", lastName: "Fernandez", suffix: null,
    gender: "FEMALE" as Gender, dateOfBirth: new Date("1994-05-09"),
    civilStatus: "SINGLE" as CivilStatus,
    personalEmail: "pt.staff@hsj.org.ph",
    mobilePhone: "09215678905",
    presentAddress: "15 Bonifacio Ave., Parañaque City",
    emergencyContactName: "Juanita Fernandez", emergencyContactRel: "Mother", emergencyContactPhone: "09215678906",
    unitCode: "HLT", roleCode: "PT_STAFF",
    
    employmentStatus: "PROBATIONARY" as EmploymentStatus,
    hireDate: new Date("2023-11-15"),
    sssNumber: "33-5656565-6", philhealthNumber: "12-565656565-0", pagibigNumber: "5656-5656-5656", tinNumber: "565-656-565-000",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function seedUnits() {
  console.log("📦 Seeding Units...");
  const units: Record<string, string> = {};
  for (const unit of UNITS) {
    const created = await prisma.unit.upsert({
      where: { code: unit.code },
      update: { name: unit.name, description: unit.description },
      create: { name: unit.name, code: unit.code, description: unit.description },
    });
    units[unit.code] = created.id;
    console.log(`  ✓ ${unit.name} (${unit.code})`);
  }
  return units;
}

async function seedJobRoles(unitIds: Record<string, string>) {
  console.log("\n👔 Seeding Job Roles...");
  const roles: Record<string, string> = {};
  for (const role of JOB_ROLES) {
    const unitId = unitIds[role.unitCode];
    if (!unitId) throw new Error(`Unit not found for code: ${role.unitCode}`);
    const created = await prisma.jobRole.upsert({
      where: { code: role.code },
      update: { title: role.title, unitId, permissionTier: role.tier },
      create: { title: role.title, code: role.code, unitId, permissionTier: role.tier },
    });
    roles[role.code] = created.id;
    console.log(`  ✓ [${role.tier}] ${role.title}`);
  }
  return roles;
}

async function seedPermissions() {
  console.log("\n🔑 Seeding Permissions...");
  const perms: Record<string, string> = {};
  for (const perm of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { module_action_scope: { module: perm.module, action: perm.action, scope: perm.scope } },
      update: { description: perm.description },
      create: perm,
    });
    perms[`${perm.module}.${perm.action}.${perm.scope}`] = created.id;
    console.log(`  ✓ ${perm.module}.${perm.action}.${perm.scope}`);
  }
  return perms;
}

async function seedRolePermissions(roleIds: Record<string, string>, permIds: Record<string, string>) {
  console.log("\n🔗 Seeding RolePermissions...");
  let count = 0;

  for (const [roleCode, roleId] of Object.entries(roleIds)) {
    const role = JOB_ROLES.find((r) => r.code === roleCode);
    if (!role) continue;

    let permKeys: string[];
    if (role.tier === "FULL") permKeys = FULL_PERMISSIONS;
    else if (role.tier === "SUPERVISOR") permKeys = SUPERVISOR_PERMISSIONS;
    else permKeys = STANDARD_PERMISSIONS;

    for (const key of permKeys) {
      const permId = permIds[key];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { jobRoleId_permissionId: { jobRoleId: roleId, permissionId: permId } },
        update: {},
        create: { jobRoleId: roleId, permissionId: permId },
      });
      count++;
    }
  }
  console.log(`  ✓ ${count} role-permission links created`);
}

async function seedEmployeesAndUsers(unitIds: Record<string, string>, roleIds: Record<string, string>) {
  console.log("\n👥 Seeding Employees and Users...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  const employeeIds: Record<string, string> = {};

  for (const emp of SAMPLE_EMPLOYEES) {
    const unitId = unitIds[emp.unitCode];
    const jobRoleId = roleIds[emp.roleCode];
    if (!unitId || !jobRoleId) throw new Error(`Unit or role not found for ${emp.employeeNumber}`);

    const employee = await prisma.employee.upsert({
      where: { employeeNumber: emp.employeeNumber },
      update: {},
      create: {
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        middleName: emp.middleName,
        lastName: emp.lastName,
        suffix: emp.suffix,
        gender: emp.gender,
        dateOfBirth: emp.dateOfBirth,
        civilStatus: emp.civilStatus,
        personalEmail: emp.personalEmail,
        mobilePhone: emp.mobilePhone,
        presentAddress: emp.presentAddress,
        emergencyContactName: emp.emergencyContactName,
        emergencyContactRel: emp.emergencyContactRel,
        emergencyContactPhone: emp.emergencyContactPhone,
        unitId,
        jobRoleId,
        
        employmentStatus: "REGULAR",
        employmentState: "ACTIVE",
        workSchedule: "REGULAR_DAY_SHIFT",
        hireDate: emp.hireDate,
        sssNumber: emp.sssNumber,
        philhealthNumber: emp.philhealthNumber,
        pagibigNumber: emp.pagibigNumber,
        tinNumber: emp.tinNumber,
      },
    });
    employeeIds[emp.employeeNumber] = employee.id;

    // Create linked User account
    if (emp.personalEmail) {
      await prisma.user.upsert({
        where: { email: emp.personalEmail },
        update: {},
        create: {
          email: emp.personalEmail,
          passwordHash,
          employeeId: employee.id,
          isActive: true,
          isEmailVerified: true,
        },
      });
    }
    console.log(`  ✓ ${emp.firstName} ${emp.lastName} (${emp.employeeNumber}) — ${emp.roleCode}`);
  }
  return employeeIds;
}

async function seedSupervisionLinks(employeeIds: Record<string, string>) {
  console.log("\n🔗 Seeding Supervision Links...");
  // Kitchen Supervisor (HSJ-006) supervises Kitchen Staff (HSJ-007)
  if (employeeIds["HSJ-006"] && employeeIds["HSJ-007"]) {
    await prisma.supervisionLink.upsert({
      where: { supervisorId_subordinateId: { supervisorId: employeeIds["HSJ-006"], subordinateId: employeeIds["HSJ-007"] } },
      update: {},
      create: { supervisorId: employeeIds["HSJ-006"], subordinateId: employeeIds["HSJ-007"] },
    });
    console.log("  ✓ Teresita Aquino (Kitchen Supervisor) → Danilo Mendoza (Kitchen Staff)");
  }
  // Head SSD (HSJ-008) supervises Social Worker (HSJ-009) and Psychologist (HSJ-010)
  for (const subCode of ["HSJ-009", "HSJ-010"]) {
    if (employeeIds["HSJ-008"] && employeeIds[subCode]) {
      await prisma.supervisionLink.upsert({
        where: { supervisorId_subordinateId: { supervisorId: employeeIds["HSJ-008"], subordinateId: employeeIds[subCode] } },
        update: {},
        create: { supervisorId: employeeIds["HSJ-008"], subordinateId: employeeIds[subCode] },
      });
    }
  }
  console.log("  ✓ Lourdes Santos (Head SSD) → Patricia Torres, Cristina dela Rosa");

  // Head PCH (HSJ-011) supervises Chapel Staff (HSJ-012)
  if (employeeIds["HSJ-011"] && employeeIds["HSJ-012"]) {
    await prisma.supervisionLink.upsert({
      where: { supervisorId_subordinateId: { supervisorId: employeeIds["HSJ-011"], subordinateId: employeeIds["HSJ-012"] } },
      update: {},
      create: { supervisorId: employeeIds["HSJ-011"], subordinateId: employeeIds["HSJ-012"] },
    });
    console.log("  ✓ Erlinda Pascual (Head PCH) → Natividad Soriano (Chapel Staff)");
  }
  // PT Coordinator (HSJ-014) supervises PT Staff (HSJ-015)
  if (employeeIds["HSJ-014"] && employeeIds["HSJ-015"]) {
    await prisma.supervisionLink.upsert({
      where: { supervisorId_subordinateId: { supervisorId: employeeIds["HSJ-014"], subordinateId: employeeIds["HSJ-015"] } },
      update: {},
      create: { supervisorId: employeeIds["HSJ-014"], subordinateId: employeeIds["HSJ-015"] },
    });
    console.log("  ✓ Benjamin Gonzales (PT Coordinator) → Marilou Fernandez (PT Staff)");
  }
}

async function seedLeaveBalances(employeeIds: Record<string, string>) {
  console.log("\n📅 Seeding Leave Balances...");
  const year = new Date().getFullYear();
  const leaveTypes: Array<{ type: LeaveType; allotted: number }> = [
    { type: "SICK", allotted: 15 },
    { type: "VACATION", allotted: 15 },
    { type: "EMERGENCY", allotted: 5 },
  ];

  for (const empId of Object.values(employeeIds)) {
    for (const { type, allotted } of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_year_leaveType: { employeeId: empId, year, leaveType: type } },
        update: {},
        create: { employeeId: empId, year, leaveType: type, totalAllotted: allotted, used: 0, pending: 0 },
      });
    }
  }
  console.log(`  ✓ Leave balances for ${Object.keys(employeeIds).length} employees`);
}

async function seedAttendance(employeeIds: Record<string, string>) {
  console.log("\n🕐 Seeding Sample Attendance Records...");
  const today = new Date();
  let count = 0;

  // Create 7 days of attendance for HSJ-007 (Kitchen Staff) and HSJ-009 (Social Worker)
  for (const empNum of ["HSJ-007", "HSJ-009", "HSJ-012", "HSJ-015"]) {
    const empId = employeeIds[empNum];
    if (!empId) continue;
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend) continue;

      const status: AttendanceStatus = d === 3 ? "LATE" : "PRESENT";
      const timeIn = new Date(date);
      timeIn.setHours(d === 3 ? 8 : 7, d === 3 ? 15 : 0, 0);
      const timeOut = new Date(date);
      timeOut.setHours(16, 0, 0);

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        update: {},
        create: {
          employeeId: empId, date, timeIn, timeOut,
          status, hoursWorked: 8, overtimeHours: 0,
        },
      });

      if (status === "LATE") {
        await prisma.attendanceLog.create({
          data: {
            employeeId: empId, logType: "LATE", logDate: date,
            minutesLate: 15, notes: "Traffic delay",
          },
        }).catch(() => {}); // ignore duplicate
      }
      count++;
    }
  }
  console.log(`  ✓ ${count} attendance records`);
}

async function seedLeaveRequests(employeeIds: Record<string, string>) {
  console.log("\n🏖️ Seeding Leave Requests...");
  const empId = employeeIds["HSJ-007"]; // Kitchen Staff
  const approverId = employeeIds["HSJ-001"]; // HR Officer
  if (!empId || !approverId) return;

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekEnd = new Date(nextWeek);
  nextWeekEnd.setDate(nextWeek.getDate() + 2);

  await prisma.leaveRequest.create({
    data: {
      employeeId: empId, leaveType: "VACATION",
      startDate: nextWeek, endDate: nextWeekEnd, totalDays: 3,
      reason: "Family vacation trip to Batangas", status: "PENDING",
    },
  }).catch(() => {});

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 14);
  const lastWeekEnd = new Date(lastWeek);
  lastWeekEnd.setDate(lastWeek.getDate() + 1);

  await prisma.leaveRequest.create({
    data: {
      employeeId: empId, leaveType: "SICK",
      startDate: lastWeek, endDate: lastWeekEnd, totalDays: 2,
      reason: "Flu and fever", status: "APPROVED",
      approvedById: approverId, approvedAt: new Date(lastWeek.getTime() - 86400000),
    },
  }).catch(() => {});

  console.log("  ✓ 2 leave requests for Danilo Mendoza");
}

// NOTE: Payroll / payslips are permanently OUT OF SCOPE for HRISense.
// The seedPayslips() routine was removed so nothing seeds, reads, or advertises
// payroll data. The legacy `payslips` table remains in the schema as inert history.

async function seedTrainings(employeeIds: Record<string, string>) {
  console.log("\n📚 Seeding Trainings...");
  const allEmpIds = Object.values(employeeIds);

  const trainings = [
    {
      title: "BLS Recertification Training",
      type: "RECERTIFICATION",
      facilitator: "Philippine Red Cross",
      venue: "HSJ Training Room A",
      startDate: new Date("2026-07-22T08:00:00"),
      endDate: new Date("2026-07-22T17:00:00"),
      hoursCredit: 8,
      maxParticipants: 30,
      status: "UPCOMING" as TrainingStatus,
      attendeeNums: ["HSJ-013", "HSJ-014", "HSJ-015"],
    },
    {
      title: "Fire Safety and Evacuation Drill",
      type: "DRILL",
      facilitator: "Bureau of Fire Protection — Manila",
      venue: "HSJ Grounds",
      startDate: new Date("2026-07-28T14:00:00"),
      endDate: new Date("2026-07-28T16:00:00"),
      hoursCredit: 2,
      maxParticipants: 100,
      status: "UPCOMING" as TrainingStatus,
      attendeeNums: ["HSJ-001", "HSJ-002", "HSJ-003", "HSJ-006", "HSJ-013"],
    },
    {
      title: "Child Rights and Protection Seminar",
      type: "SEMINAR",
      facilitator: "DSWD — NCR",
      venue: "HSJ Conference Room",
      startDate: new Date("2026-06-15T08:00:00"),
      endDate: new Date("2026-06-15T17:00:00"),
      hoursCredit: 8,
      status: "COMPLETED" as TrainingStatus,
      attendeeNums: ["HSJ-008", "HSJ-009", "HSJ-011", "HSJ-012"],
    },
  ];

  for (const t of trainings) {
    const training = await prisma.training.create({
      data: {
        title: t.title, type: t.type, facilitator: t.facilitator,
        venue: t.venue, startDate: t.startDate, endDate: t.endDate,
        hoursCredit: t.hoursCredit, maxParticipants: t.maxParticipants,
        status: t.status,
      },
    });

    for (const empNum of (t.attendeeNums || [])) {
      const empId = employeeIds[empNum];
      if (empId) {
        await prisma.trainingAttendee.create({
          data: {
            trainingId: training.id, employeeId: empId,
            attended: t.status === "COMPLETED",
            completedAt: t.status === "COMPLETED" ? t.endDate : null,
          },
        }).catch(() => {});
      }
    }
    console.log(`  ✓ ${t.title}`);
  }
}

/**
 * Seeds a small set of employee-scoped compliance requirements against the
 * CURRENT `ComplianceRequirement` model.
 *
 * The previous version wrote `ComplianceCategory` values (REGULATORY / SAFETY /
 * SSS / PHILHEALTH) into this model, which only accepts `RequirementCategory`.
 * Prisma rejected every row and the `.catch(() => {})` swallowed the failure, so
 * compliance seeding silently did nothing.
 *
 * No expiry period or reminder window is seeded — those are HR policy decisions
 * that Hospicio de San Jose has not confirmed, and HRISense must never invent them.
 */
async function seedCompliance() {
  console.log("\n📋 Seeding Compliance Requirements...");
  const requirements: Array<{
    title: string;
    description: string;
    category: RequirementCategory;
  }> = [
    {
      title: "Annual Medical Examination",
      description: "Annual physical examination on file for the employee.",
      category: RequirementCategory.MEDICAL,
    },
    {
      title: "Pre-Employment Psychological Assessment",
      description: "Psychological assessment completed before or at the start of employment.",
      category: RequirementCategory.PSYCHOLOGICAL,
    },
    {
      title: "Basic Life Support (BLS) Certification",
      description: "Valid BLS certificate on file.",
      category: RequirementCategory.CERTIFICATION,
    },
    {
      title: "Signed Employment Contract",
      description: "Signed copy of the employment contract on file.",
      category: RequirementCategory.DOCUMENT,
    },
  ];

  for (const req of requirements) {
    try {
      const existing = await prisma.complianceRequirement.findFirst({
        where: { title: req.title, deletedAt: null },
      });
      if (existing) {
        console.log(`  • ${req.title} (already present)`);
        continue;
      }

      const created = await prisma.complianceRequirement.create({
        data: {
          title: req.title,
          description: req.description,
          category: req.category,
          // Expiry tracking is left OFF: HR configures it once policy is confirmed.
          tracksExpiry: false,
          reminderDays: null,
        },
      });

      // Applies to every active employee until HR narrows the scope.
      await prisma.complianceRequirementScope.create({
        data: { requirementId: created.id, scopeType: "ALL" },
      });

      console.log(`  ✓ ${req.title} [${req.category}]`);
    } catch (err) {
      console.error(`  ✗ Failed to seed requirement "${req.title}":`, err);
    }
  }
}

async function seedAnnouncements(employeeIds: Record<string, string>) {
  console.log("\n📢 Seeding Announcements...");
  const authorId = employeeIds["HSJ-001"]; // HR Officer
  if (!authorId) return;

  const announcements = [
    {
      title: "Mandatory Fire Safety Drill — July 28, 2026",
      content: "All staff are required to participate in the mandatory fire safety and evacuation drill on July 28, 2026 at 2:00 PM. Please report to your unit's designated assembly area. Attendance will be marked. Department heads must ensure full team participation.",
      priority: "URGENT" as AnnouncementPriority,
      audience: "ALL" as AnnouncementAudience,
      isPinned: true,
      publishedAt: new Date("2026-07-15"),
    },
    {
      title: "Updated Leave Request Procedure Effective August 1, 2026",
      content: "Effective August 1, 2026, all leave requests must be filed through the HRISense system at least 5 working days in advance. Walk-in requests at the HR office will no longer be accommodated except for emergency leaves. Please ensure your account is active and your leave balances are updated.",
      priority: "IMPORTANT" as AnnouncementPriority,
      audience: "ALL" as AnnouncementAudience,
      isPinned: true,
      publishedAt: new Date("2026-07-12"),
    },
    {
      title: "Reminder: DSWD License Renewal Documentation",
      content: "All department heads and unit supervisors are reminded to submit updated personnel lists, training certificates, and clearances to the HR office no later than July 25, 2026. These documents are required for the DSWD license renewal process. Late submissions will delay the renewal.",
      priority: "IMPORTANT" as AnnouncementPriority,
      audience: "ALL" as AnnouncementAudience,
      isPinned: false,
      publishedAt: new Date("2026-07-10"),
    },
    {
      title: "Welcome to HRISense!",
      content: "We are excited to officially launch HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision for Hospicio de San Jose. All employees now have access to their personal dashboard where you can view your attendance records, file leave requests, and access your training records. For assistance, please contact the HR Department.",
      priority: "NORMAL" as AnnouncementPriority,
      audience: "ALL" as AnnouncementAudience,
      isPinned: false,
      publishedAt: new Date("2026-07-01"),
    },
  ];

  for (const ann of announcements) {
    await prisma.announcement.create({ data: { ...ann, authorId } }).catch(() => {});
    console.log(`  ✓ ${ann.title}`);
  }
}

// NOTE: AI insights are NEVER seeded.
// The previous seedAIInsights() wrote fabricated attrition-risk and staffing
// insights with invented confidence scores straight into the ai_insights table,
// which the dashboard then displayed as if it were real analysis. AI Assistance
// now generates and persists its own insights from real workforce data.

async function seedSystemSettings() {
  console.log("\n⚙️ Seeding System Settings...");
  const settings = [
    { key: "org_name", value: "Hospicio de San Jose", description: "Full organization name" },
    { key: "org_short_name", value: "HSJ", description: "Organization abbreviation" },
    { key: "system_name", value: "HRISense", description: "System name" },
    { key: "leave_advance_days", value: "5", description: "Minimum days in advance to file leave requests" },
    { key: "attendance_grace_period_minutes", value: "10", description: "Grace period for late arrivals before it is logged" },
    { key: "fiscal_year_start_month", value: "1", description: "Month when fiscal year begins (1=January)" },
    { key: "ai_insights_enabled", value: "true", description: "Whether AI workforce insights are generated" },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`  ✓ ${settings.length} system settings`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function seedHRAdministrator(unitIds: Record<string, string>, roleIds: Record<string, string>) {
  console.log("\n👑 Seeding Initial HR Personnel Account...");

  // No weak hardcoded credential. Supply SEED_HR_PASSWORD for a repeatable local
  // password; otherwise a strong random one is generated and printed once.
  const hrPassword = process.env.SEED_HR_PASSWORD || generateSeedPassword();
  const passwordHash = await bcrypt.hash(hrPassword, SALT_ROUNDS);

  const unitId = unitIds["HRD"];
  const jobRoleId = roleIds["HR_OFFICER"]; // FULL tier

  if (!unitId || !jobRoleId) throw new Error("Unit or Job Role missing for HR Administrator");

  const emp = await prisma.employee.upsert({
    where: { employeeNumber: "ADMIN-001" },
    update: {
      firstName: "Earl",
      lastName: "Angelo",
      gender: "MALE"
    },
    create: {
      employeeNumber: "ADMIN-001",
      firstName: "Earl",
      lastName: "Angelo",
      gender: "MALE",
      dateOfBirth: new Date("1980-01-01"),
      civilStatus: "SINGLE",
      presentAddress: "Hospicio de San Jose",
      mobilePhone: "00000000000",
      emergencyContactName: "None",
      emergencyContactRel: "None",
      emergencyContactPhone: "00000000000",
      personalEmail: "HR@gmail.com",
      unitId,
      jobRoleId,
      
      employmentStatus: "REGULAR", employmentState: "ACTIVE",
      hireDate: new Date(),
    }
  });

  await prisma.user.upsert({
    where: { email: "HR@gmail.com" },
    update: {
      passwordHash,
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0
    },
    create: {
      email: "HR@gmail.com",
      passwordHash,
      employeeId: emp.id,
      isActive: true,
      isEmailVerified: true,
    }
  });

  console.log("  ✓ HR Personnel account created: HR@gmail.com");
  if (process.env.SEED_HR_PASSWORD) {
    console.log("    Password: taken from SEED_HR_PASSWORD");
  } else {
    console.log(`    Generated password (shown once): ${hrPassword}`);
  }
}

async function main() {
  // This is the old local sample seed (its own sample staff and HR@gmail.com).
  // A hosted demo database is seeded with `npm run db:seed:demo` instead.
  if (process.env.NODE_ENV === "production") {
    throw new Error("prisma/seed.ts is the local development seed. On a hosted database run `npm run db:seed:demo` (see prisma/demo/README.md).");
  }

  console.log("\n🏥 HRISense Seed Script — Hospicio de San Jose");
  console.log("━".repeat(55));

  const unitIds = await seedUnits();
  const roleIds = await seedJobRoles(unitIds);
  const permIds = await seedPermissions();
  await seedRolePermissions(roleIds, permIds);
  const employeeIds = await seedEmployeesAndUsers(unitIds, roleIds);
  await seedSupervisionLinks(employeeIds);
  try { await seedLeaveBalances(employeeIds); } catch (e) { console.error('Error seeding Leave balances:', e); }
  try { await seedAttendance(employeeIds); } catch (e) { console.error('Error seeding Attendance:', e); }
  try { await seedLeaveRequests(employeeIds); } catch (e) { console.error('Error seeding Leave requests:', e); }
  try { await seedTrainings(employeeIds); } catch (e) { console.error('Error seeding Trainings:', e); }
  try { await seedCompliance(); } catch (e) { console.error('Error seeding Compliance:', e); }
  try { await seedAnnouncements(employeeIds); } catch (e) { console.error('Error seeding Announcements:', e); }
  try { await seedSystemSettings(); } catch (e) { console.error('Error seeding System Settings:', e); }
  try { await seedHRAdministrator(unitIds, roleIds); } catch (e) { console.error('Error seeding HR Administrator:', e); }

  console.log("\n" + "━".repeat(55));
  console.log("✅ Seed complete!\n");
  console.log("Local development accounts:");
  console.log("  HR Personnel (FULL):      HR@gmail.com   — password printed above");
  console.log("  HR Officer (FULL):        hr.officer@hsj.org.ph");
  console.log("  Kitchen Supervisor (SUP): kitchen.sup@hsj.org.ph");
  console.log("  Kitchen Staff (STD):      kitchen.staff1@hsj.org.ph");
  console.log(
    process.env.SEED_DEFAULT_PASSWORD
      ? "  Password for the sample staff accounts: value of SEED_DEFAULT_PASSWORD"
      : `  Password for the sample staff accounts (shown once): ${DEFAULT_PASSWORD}`
  );
  console.log("");
  console.log("These accounts are for LOCAL DEVELOPMENT ONLY. Never seed them into a");
  console.log("deployment that real Hospicio de San Jose staff can reach.");
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
