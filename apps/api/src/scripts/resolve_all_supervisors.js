const { PrismaClient } = require('@prisma/client');
const { SupervisorResolverService } = require('../../dist/services/supervisor-resolver.service');

const prisma = new PrismaClient();

async function resolveAllSupervisors() {
  const employees = await prisma.employee.findMany({ where: { deletedAt: null } });
  console.log(`Resolving supervisors for ${employees.length} employees...`);
  const resolver = new SupervisorResolverService();
  let assignedCount = 0;
  let pendingCount = 0;

  for (const emp of employees) {
    if (emp.jobRoleId) {
      const res = await resolver.resolveForEmployee(emp.id, emp.jobRoleId);
      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          immediateSupervisorId: res.supervisorId,
          supervisorAssignmentStatus: res.assignmentStatus,
          supervisorAssignmentSource: res.assignmentSource,
          supervisorPendingReason: res.pendingReason,
        }
      });
      if (res.assignmentStatus === 'ASSIGNED') assignedCount++;
      else pendingCount++;
    }
  }

  console.log(`Resolution complete! Assigned: ${assignedCount}, Pending: ${pendingCount}`);
  await prisma.$disconnect();
}

resolveAllSupervisors().catch(console.error);
