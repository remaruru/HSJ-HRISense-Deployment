import { PrismaClient, Unit, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class UnitService {
  static async createUnit(data: Prisma.UnitCreateInput): Promise<Unit> {
    return prisma.unit.create({ data });
  }

  static async getUnits(): Promise<Unit[]> {
    return prisma.unit.findMany({
      orderBy: { name: 'asc' },
      include: { department: true },
    });
  }

  static async getUnitById(id: string): Promise<Unit | null> {
    return prisma.unit.findUnique({
      where: { id },
      include: { department: true, jobRoles: true },
    });
  }

  static async updateUnit(id: string, data: Prisma.UnitUpdateInput): Promise<Unit> {
    return prisma.unit.update({
      where: { id },
      data,
    });
  }

  static async deleteUnit(id: string): Promise<Unit> {
    return prisma.unit.delete({
      where: { id },
    });
  }
}
