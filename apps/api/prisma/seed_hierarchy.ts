import { PrismaClient, HierarchyConfigurationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Phase 4B: Organizational Master Data Mapping');

  // 1. Fetch all units
  const units = await prisma.unit.findMany();
  const unitMap = units.reduce((acc, unit) => {
    acc[unit.code] = unit.id;
    return acc;
  }, {} as Record<string, string>);

  // 2. Fetch all job roles
  const roles = await prisma.jobRole.findMany();
  const roleMap = roles.reduce((acc, role) => {
    acc[role.code] = role.id;
    return acc;
  }, {} as Record<string, string>);

  const updates = [
    // Top-Level Structure
    {
      code: 'ASST_ADMIN', // Assistant Administrator
      isHead: true,
      isSupervisor: true,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'ADMIN_SEC', // Administrative Secretaries
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['ASST_ADMIN'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    
    // Human Resources
    {
      code: 'HR_OFFICER', // Human Resource Officer -> Equivalent to "Human Resource Development Officer"
      isHead: true,
      isSupervisor: true,
      parentJobRoleId: roleMap['ASST_ADMIN'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'HR_ASSISTANT', // Human Resource Assistant/Staff -> Equivalent to "HRD Assistant"
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HR_OFFICER'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },

    // Social Services
    {
      code: 'HEAD_SSD', // Head SSD -> Equivalent to "Head Social Services"
      isHead: true,
      isSupervisor: true,
      parentJobRoleId: roleMap['ASST_ADMIN'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'SOCIAL_WORKER',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HEAD_SSD'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'PSYCHOLOGIST',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HEAD_SSD'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'PT_PSYCHOLOGIST',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HEAD_SSD'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'ECCD_TEACHER', // Not equivalent to SPED Teacher
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HEAD_SSD'],
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },

    // Pastoral Care / Homelife Services
    {
      code: 'HEAD_PCH', // Exact Match
      isHead: true,
      isSupervisor: true,
      parentJobRoleId: roleMap['ASST_ADMIN'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'CY_COORDINATOR', // Equivalent to "Coordinator - Children and Youth"
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: roleMap['HEAD_PCH'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'PSN_COORDINATOR', // Equivalent to "Coordinator - Persons with Special Needs"
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: roleMap['HEAD_PCH'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'OP_COORDINATOR', // Equivalent to "Coordinator - Older Persons"
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: roleMap['HEAD_PCH'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'CIP_COORDINATOR', // Unresolved mapping
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: roleMap['HEAD_PCH'],
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'CHAPEL_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['HEAD_PCH'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    // Unconfirmed PCH Staff
    ...[
      'ST_MARY_STAFF', 'ST_JOSEPH_STAFF', 'RENDU_A_STAFF', 'RENDU_B_STAFF', 
      'RENDU_C_STAFF', 'STA_LUISA_STAFF', 'ST_VINCENT_STAFF', 'TAHAN_CENTER_STAFF', 
      'SANCTUARY_CENTER_STAFF', 'SIGLIV_BOYS_STAFF', 'PRE_SCHOOL_STAFF'
    ].map(code => ({
      code,
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    })),

    // Health Services
    {
      code: 'PT_COORDINATOR', // Equivalent to "PT/OT Coordinator"
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: null, // Head Health Services missing
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'PT_STAFF', // Equivalent to "PT/OT Staff"
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['PT_COORDINATOR'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'CLINIC_STAFF',
      isHead: false,
      isSupervisor: true, // Special handling for Clinic Staff supervisory access
      parentJobRoleId: null, // Head Health Services missing
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },

    // Administrative Services (FIN, GSS, ADM, AUX) missing parents
    {
      code: 'ACCOUNTING_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'PMO_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'LIAISON_OFFICER',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'STOCKROOM_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'JANITORIAL_SUPERVISOR',
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'JANITORIAL_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['JANITORIAL_SUPERVISOR'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'KITCHEN_SUPERVISOR',
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'KITCHEN_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['KITCHEN_SUPERVISOR'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'MAINTENANCE_SUPERVISOR',
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'MAINTENANCE_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: roleMap['MAINTENANCE_SUPERVISOR'],
      hierarchyStatus: HierarchyConfigurationStatus.CONFIRMED,
    },
    {
      code: 'LAUNDRY_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'DRIVER',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'DORMITORY_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'CANTEEN_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'BAKERY_STAFF',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'RECEPTIONIST',
      isHead: false,
      isSupervisor: false,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    },
    {
      code: 'IGP_COORDINATOR',
      isHead: false,
      isSupervisor: true,
      parentJobRoleId: null,
      hierarchyStatus: HierarchyConfigurationStatus.PENDING_CONFIRMATION,
    }
  ];

  for (const update of updates) {
    if (!roleMap[update.code]) {
      console.warn(`Job Role ${update.code} not found in DB!`);
      continue;
    }
    await prisma.jobRole.update({
      where: { code: update.code },
      data: {
        isHead: update.isHead,
        isSupervisor: update.isSupervisor,
        parentJobRoleId: update.parentJobRoleId,
        hierarchyStatus: update.hierarchyStatus,
      }
    });
  }

  console.log('Roles mapped.');

  // Assign Unit Heads
  const unitHeadMappings = [
    { unitCode: 'HRD', roleCode: 'HR_OFFICER' },
    { unitCode: 'SOC', roleCode: 'HEAD_SSD' },
    { unitCode: 'PCH', roleCode: 'HEAD_PCH' },
    // ADM missing Head Administrative Services
    // HLT missing Head Health Services
  ];

  for (const mapping of unitHeadMappings) {
    if (unitMap[mapping.unitCode] && roleMap[mapping.roleCode]) {
      await prisma.unit.update({
        where: { code: mapping.unitCode },
        data: { headJobRoleId: roleMap[mapping.roleCode] }
      });
    }
  }
  console.log('Unit heads mapped.');
}

main()
  .then(() => console.log('Seed Script Executed Successfully'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
