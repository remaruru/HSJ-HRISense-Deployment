import { JobRole, PermissionTier, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export class JobRoleService {
  /**
   * A new position (job role). Refuses a title that matches an existing role
   * once case, spacing, punctuation and a plural "s" are ignored ("Kitchen
   * staff" = "Kitchen Staff" = "Kitchen-Staffs"), so a spelling difference
   * cannot create a duplicate. The code is generated from the title.
   */
  static async createPosition(input: {
    title: string;
    unitId: string;
    departmentId?: string | null;
    parentJobRoleId?: string | null;
    permissionTier?: PermissionTier;
  }): Promise<JobRole> {
    const title = String(input.title ?? '').replace(/\s+/g, ' ').trim();
    if (title.length < 2) throw new AppError('Enter the position title.', 400);
    if (title.length > 120) throw new AppError('The position title is too long.', 400);
    const existing = await prisma.jobRole.findMany({ select: { id: true, title: true } });
    const twin = existing.find((r) => normalizeRoleTitle(r.title) === normalizeRoleTitle(title));
    if (twin) throw new AppError(`“${twin.title}” already exists — choose it instead of creating a new position.`, 409);

    const unit = await prisma.unit.findUnique({ where: { id: input.unitId }, select: { id: true } });
    if (!unit) throw new AppError('Choose the unit this position belongs to.', 400);
    if (input.departmentId && !(await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } }))) {
      throw new AppError('The chosen department no longer exists.', 400);
    }
    if (input.parentJobRoleId && !existing.some((r) => r.id === input.parentJobRoleId)) {
      throw new AppError('The chosen supervising position no longer exists.', 400);
    }
    // A position created here is a staff or supervisory role; full (HR) access
    // is never granted from a job-opening form.
    const tier = input.permissionTier === PermissionTier.SUPERVISOR ? PermissionTier.SUPERVISOR : PermissionTier.STANDARD;

    const base = title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'POSITION';
    const codes = new Set((await prisma.jobRole.findMany({ select: { code: true } })).map((r) => r.code));
    let code = base;
    for (let i = 2; codes.has(code); i++) code = `${base}_${i}`;

    return prisma.jobRole.create({
      data: {
        title,
        code,
        unitId: unit.id,
        departmentId: input.departmentId || null,
        parentJobRoleId: input.parentJobRoleId || null,
        permissionTier: tier,
        isSupervisor: tier === PermissionTier.SUPERVISOR,
      },
    });
  }

  static async createJobRole(data: Prisma.JobRoleCreateInput): Promise<JobRole> {
    return prisma.jobRole.create({ data });
  }

  static async getJobRoles(): Promise<JobRole[]> {
    return prisma.jobRole.findMany({
      orderBy: { title: 'asc' },
      include: { unit: true },
    });
  }

  static async getJobRoleById(id: string): Promise<JobRole | null> {
    return prisma.jobRole.findUnique({
      where: { id },
      include: { unit: true, rolePermissions: { include: { permission: true } } },
    });
  }

  static async updateJobRole(id: string, data: Prisma.JobRoleUpdateInput): Promise<JobRole> {
    return prisma.jobRole.update({
      where: { id },
      data,
    });
  }

  static async deleteJobRole(id: string): Promise<JobRole> {
    return prisma.jobRole.delete({
      where: { id },
    });
  }
}

/** "Kitchen-Staffs " → "kitchen staff": how two titles are compared for duplicates. */
export function normalizeRoleTitle(title: string): string {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}
