import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier } from '@prisma/client';

export class SearchService {
  static async globalSearch(
    requestingEmployeeId: string,
    permissionTier: PermissionTier,
    query: string
  ) {
    if (!query || query.trim().length < 2) {
      return {
        employees: [],
        drafts: [],
        archivedEmployees: [],
      };
    }

    const q = query.trim();
    const limit = 6;

    const safeEmployeeSelect = {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      middleName: true,
      personalEmail: true,
      deletedAt: true,
      unit: { select: { name: true } },
      department: { select: { name: true } },
      jobRole: { select: { title: true } },
    };

    const safeDraftSelect = {
      id: true,
      displayName: true,
      email: true,
      stepName: true,
      updatedAt: true,
      unitName: true,
      jobRoleTitle: true,
    };

    const employeeSearchWhere = {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { middleName: { contains: q } },
        { employeeNumber: { contains: q } },
        { personalEmail: { contains: q } },
        // Older accounts may still sign in with a previous address.
        { user: { email: { contains: q } } },
        { jobRole: { title: { contains: q } } },
        { unit: { name: { contains: q } } },
      ],
    };

    if (permissionTier === PermissionTier.FULL) {
      const [employees, archivedEmployees] = await Promise.all([
        prisma.employee.findMany({
          where: { ...employeeSearchWhere, deletedAt: null },
          select: safeEmployeeSelect,
          take: limit,
        }),
        prisma.employee.findMany({
          where: { ...employeeSearchWhere, deletedAt: { not: null } },
          select: safeEmployeeSelect,
          take: limit,
        }),
      ]);

      const allDrafts = await prisma.onboardingDraft.findMany({
        where: { status: 'DRAFT' },
      });

      const qLower = q.toLowerCase();
      const drafts = allDrafts.map((d: any) => {
        const data = d.data || {};
        return {
          id: d.id,
          displayName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          email: data.personalEmail || '',
          stepName: data.currentStep || 'Draft',
          updatedAt: d.updatedAt,
          unitName: data.unitId ? 'Assigned Unit' : null,
          jobRoleTitle: data.jobRoleId ? 'Assigned Role' : null,
        };
      }).filter((d: any) => 
        d.id.includes(q) || 
        d.displayName.toLowerCase().includes(qLower) || 
        d.email.toLowerCase().includes(qLower)
      ).slice(0, limit);

      return { employees, archivedEmployees, drafts };
    } 
    
    if (permissionTier === PermissionTier.SUPERVISOR) {
      const supervisorWhere = {
        AND: [
          employeeSearchWhere,
          {
            OR: [
              { id: requestingEmployeeId },
              { immediateSupervisorId: requestingEmployeeId },
            ]
          },
          { deletedAt: null }
        ]
      };

      const employees = await prisma.employee.findMany({
        where: supervisorWhere,
        select: safeEmployeeSelect,
        take: limit,
      });

      return { employees, archivedEmployees: [], drafts: [] };
    }

    const standardWhere = {
      AND: [
        employeeSearchWhere,
        { id: requestingEmployeeId },
        { deletedAt: null }
      ]
    };

    const employees = await prisma.employee.findMany({
      where: standardWhere,
      select: safeEmployeeSelect,
      take: limit,
    });

    return { employees, archivedEmployees: [], drafts: [] };
  }
}
