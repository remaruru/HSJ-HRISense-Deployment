import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionTier } from '@prisma/client';
import { OrgHierarchyService } from '../org-hierarchy.service';
import { EmployeeService } from '../employee.service';

/**
 * Who may open an employee record, and how much of it they get.
 * HR (FULL): anyone, everything. The employee: themselves, everything.
 * A supervisor: their DIRECT reports only, as the work profile.
 */

const SUP = 'sup-0000';
const DIRECT = 'direct-0001';
const INDIRECT = 'indirect-0002'; // reports to DIRECT, who reports to SUP
const OTHER = 'other-0003';

const supervisor = { employeeId: SUP, permissionTier: PermissionTier.SUPERVISOR };
const employee = { employeeId: DIRECT, permissionTier: PermissionTier.STANDARD };
const hr = { employeeId: 'hr-0004', permissionTier: PermissionTier.FULL };

const realDirect = OrgHierarchyService.isDirectSubordinate;
const realTree = OrgHierarchyService.isInSubordinateTree;

function stubHierarchy() {
  OrgHierarchyService.isDirectSubordinate = async (s, e) => s === SUP && e === DIRECT;
  // The branch below SUP includes INDIRECT — record access must not use it.
  OrgHierarchyService.isInSubordinateTree = async (s, e) => s === SUP && (e === DIRECT || e === INDIRECT);
}

afterEach(() => {
  OrgHierarchyService.isDirectSubordinate = realDirect;
  OrgHierarchyService.isInSubordinateTree = realTree;
});

describe('canAccessEmployeeRecord — supervisors reach direct reports only', () => {
  test('a supervisor opens themselves and a direct report', async () => {
    stubHierarchy();
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(supervisor, SUP), true);
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(supervisor, DIRECT), true);
  });

  test("a supervisor is refused a coordinator's staff (indirect report) and anyone else", async () => {
    stubHierarchy();
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(supervisor, INDIRECT), false);
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(supervisor, OTHER), false);
  });

  test('an employee opens only themselves; HR opens anyone', async () => {
    stubHierarchy();
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(employee, DIRECT), true);
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(employee, SUP), false);
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord(hr, OTHER), true);
  });

  test('without an employee id a non-HR account opens nothing', async () => {
    stubHierarchy();
    assert.equal(await OrgHierarchyService.canAccessEmployeeRecord({ permissionTier: PermissionTier.SUPERVISOR }, DIRECT), false);
  });
});

describe('canViewFullEmployeeRecord — the personal record is HR and the person only', () => {
  test('HR and self: full record; a supervisor on a report: no', () => {
    assert.equal(OrgHierarchyService.canViewFullEmployeeRecord(hr, OTHER), true);
    assert.equal(OrgHierarchyService.canViewFullEmployeeRecord(employee, DIRECT), true);
    assert.equal(OrgHierarchyService.canViewFullEmployeeRecord(supervisor, SUP), true);
    assert.equal(OrgHierarchyService.canViewFullEmployeeRecord(supervisor, DIRECT), false);
    assert.equal(OrgHierarchyService.canViewFullEmployeeRecord({ permissionTier: PermissionTier.STANDARD }, DIRECT), false);
  });
});

describe('toTeamMemberView — what a supervisor receives about a direct report', () => {
  const full = {
    id: DIRECT, employeeNumber: 'DEV-001', firstName: 'Ana', middleName: 'B', lastName: 'Cruz', suffix: null,
    photoUrl: '/documents/x/preview',
    jobRoleId: 'jr', unitId: 'u', departmentId: 'd',
    jobRole: { id: 'jr', code: 'BAKERY_STAFF', title: 'Bakery Staff', permissionTier: 'STANDARD', parentJobRoleId: 'p', departmentId: 'd' },
    unit: { id: 'u', code: 'AUX', name: 'Auxiliary Services', departmentId: 'd', headJobRoleId: 'h' },
    department: { id: 'd', code: 'D', name: 'Dept' },
    employmentStatus: 'REGULAR', employmentState: 'ACTIVE',
    hireDate: '2024-01-01', probationDate: null, regularizationDate: null, separationDate: null,
    professionalRole: null, prcLicenseNumber: 'PRC-123',
    immediateSupervisorId: SUP,
    immediateSupervisor: { id: SUP, firstName: 'S', lastName: 'V', employeeNumber: 'DEV-000', jobRole: { title: 'IGP Coordinator' } },
    supervisorAssignmentStatus: 'ASSIGNED', deletedAt: null, profileCompletion: 68,
    // Personal record — must never reach a supervisor:
    dateOfBirth: '1990-01-01', placeOfBirth: 'Manila', gender: 'FEMALE', civilStatus: 'SINGLE', nationality: 'Filipino',
    religion: 'Catholic', mobilePhone: '0917', homePhone: '02', telephoneNumber: '03', personalEmail: 'ana@example.com',
    presentAddress: 'Addr 1', permanentAddress: 'Addr 2',
    sssNumber: '1', philhealthNumber: '2', pagibigNumber: '3', tinNumber: '4', otherGovernmentIds: 'x',
    governmentIds: [{ idType: 'Passport', idNumber: 'P1' }],
    emergencyContacts: [{ contactName: 'Mom' }], emergencyContactName: 'Mom', emergencyContactRel: 'Mother', emergencyContactPhone: '0918',
    biometricCode: '77', paternityLeaveEligible: false, soloParentLeaveEligible: true, hrConfidentialNotes: 'secret',
    user: { id: 'u1', email: 'ana@example.com', isActive: true, lastLoginAt: '2026-10-01', mustChangePassword: false },
    missingFields: ['SSS number'], missingFieldIds: ['sssNumber'], profileCompletionBreakdown: { items: [] },
    loginEmailMatchesPersonalEmail: true,
  };

  const view: any = EmployeeService.toTeamMemberView(full);

  test('keeps the work profile', () => {
    assert.equal(view.employeeNumber, 'DEV-001');
    assert.equal(view.jobRole.title, 'Bakery Staff');
    assert.equal(view.unit.name, 'Auxiliary Services');
    assert.equal(view.employmentState, 'ACTIVE');
    assert.equal(view.profileCompletion, 68);
    assert.equal(view.immediateSupervisor.id, SUP);
    assert.equal(view.isProfessional, true);
    assert.equal(view.viewScope, 'TEAM_MEMBER');
  });

  test('drops every personal, account and HR-only field', () => {
    for (const key of [
      'dateOfBirth', 'placeOfBirth', 'gender', 'civilStatus', 'nationality', 'religion', 'mobilePhone', 'homePhone',
      'telephoneNumber', 'personalEmail', 'presentAddress', 'permanentAddress', 'sssNumber', 'philhealthNumber',
      'pagibigNumber', 'tinNumber', 'otherGovernmentIds', 'governmentIds', 'emergencyContacts', 'emergencyContactName',
      'emergencyContactRel', 'emergencyContactPhone', 'biometricCode', 'paternityLeaveEligible', 'soloParentLeaveEligible',
      'hrConfidentialNotes', 'prcLicenseNumber', 'missingFields', 'missingFieldIds', 'profileCompletionBreakdown',
      'loginEmailMatchesPersonalEmail',
    ]) {
      assert.equal(key in view, false, key);
    }
    assert.deepEqual(view.user, { isActive: true });
    assert.equal('parentJobRoleId' in view.jobRole, false);
    assert.equal('headJobRoleId' in view.unit, false);
  });

  test('an unknown column added later stays private', () => {
    const v: any = EmployeeService.toTeamMemberView({ ...full, someNewPrivateColumn: 'x' });
    assert.equal('someNewPrivateColumn' in v, false);
  });
});
