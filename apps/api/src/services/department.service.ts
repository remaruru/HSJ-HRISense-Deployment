import { PrismaClient, Department, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class DepartmentService {
  static async createDepartment(data: Prisma.DepartmentCreateInput): Promise<Department> {
    return prisma.department.create({ data });
  }

  static async getDepartments(unitId?: string): Promise<Department[]> {
    const where: any = {};
    if (unitId) {
      where.units = { some: { id: unitId } };
    }
    return prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  static async getDepartmentById(id: string): Promise<Department | null> {
    return prisma.department.findUnique({
      where: { id },
      include: { units: true },
    });
  }

  static async updateDepartment(id: string, data: Prisma.DepartmentUpdateInput): Promise<Department> {
    return prisma.department.update({
      where: { id },
      data,
    });
  }

  static async deleteDepartment(id: string): Promise<Department> {
    return prisma.department.delete({
      where: { id },
    });
  }
}
