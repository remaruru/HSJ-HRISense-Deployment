import { prisma } from '../config/prisma';
import { JobOpeningStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { JobOpeningNotFoundError } from '../lib/recruitment.errors';
import { createAuditLog } from '../lib/audit';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

/**
 * The ONE rule for "accepting applications now": status OPEN and today inside
 * the opening's dates (closing day included). The public list, the public
 * detail page, the application endpoint and the Careers position directory all
 * use it, so "Currently hiring" never means two different things. DRAFT,
 * CLOSED, FILLED and ARCHIVED openings never qualify; neither does an OPEN one
 * whose closing date has passed.
 */
export function acceptingApplicationsWhere(now: Date = new Date()): Prisma.JobOpeningWhereInput {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return { status: JobOpeningStatus.OPEN, openingDate: { lte: now }, closingDate: { gte: startOfToday } };
}

export function isAcceptingApplications(
  opening: { status: JobOpeningStatus | string; openingDate: Date; closingDate: Date },
  now: Date = new Date()
): boolean {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return opening.status === JobOpeningStatus.OPEN && opening.openingDate <= now && opening.closingDate >= startOfToday;
}

export interface CreateJobOpeningDTO {
  title: string;
  unitId: string;
  departmentId?: string;
  jobRoleId: string;
  employmentType: EmploymentStatus;
  vacancies?: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredDocuments?: string;
  openingDate: Date;
  closingDate: Date;
}

export interface UpdateJobOpeningDTO extends Partial<CreateJobOpeningDTO> {
  status?: JobOpeningStatus;
}

export class JobOpeningService {
  private static generateSlug(title: string): string {
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const randomHash = crypto.randomBytes(3).toString('hex');
    return `${baseSlug}-${randomHash}`;
  }

  private static generateReference(): string {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `JO-${year}-${randomNum}`;
  }

  static async validateOrgStructure(unitId: string, departmentId?: string, jobRoleId?: string) {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new AppError('Unit not found', 404);

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) throw new AppError('Department not found', 404);
      if (unit.departmentId && unit.departmentId !== departmentId) {
         throw new AppError('The specified Department does not match the Unit configuration', 400);
      }
    }

    if (jobRoleId) {
      const role = await prisma.jobRole.findUnique({ where: { id: jobRoleId } });
      if (!role) throw new AppError('Job Role not found', 404);
      if (role.unitId !== unitId) throw new AppError('Job Role does not belong to the specified Unit', 400);
    }
  }

  static async createJobOpening(data: CreateJobOpeningDTO, userId: string) {
    if (data.closingDate < data.openingDate) {
      throw new AppError('Closing date must be after or equal to opening date', 400);
    }

    if (data.vacancies !== undefined && data.vacancies <= 0) {
      throw new AppError('Vacancies must be a positive number', 400);
    }

    await this.validateOrgStructure(data.unitId, data.departmentId, data.jobRoleId);

    const slug = this.generateSlug(data.title);
    const referenceNumber = this.generateReference();

    const opening = await prisma.jobOpening.create({
      data: {
        ...data,
        slug,
        referenceNumber,
        status: JobOpeningStatus.DRAFT,
        createdById: userId,
        updatedById: userId,
      },
      include: { unit: true, department: true, jobRole: true }
    });

    await createAuditLog({
      action: 'JOB_OPENING_CREATED',
      actorUserId: userId,
      entityType: 'JobOpening',
      entityId: opening.id,
      metadata: { referenceNumber: opening.referenceNumber, title: opening.title }
    });

    return opening;
  }

  static async updateJobOpening(id: string, data: UpdateJobOpeningDTO, userId: string) {
    const opening = await prisma.jobOpening.findUnique({ where: { id } });
    if (!opening) throw new JobOpeningNotFoundError();

    if (data.openingDate && data.closingDate && data.closingDate < data.openingDate) {
      throw new AppError('Closing date must be after or equal to opening date', 400);
    } else if (data.openingDate && !data.closingDate && opening.closingDate < data.openingDate) {
      throw new AppError('Opening date cannot be after the existing closing date', 400);
    } else if (data.closingDate && !data.openingDate && data.closingDate < opening.openingDate) {
      throw new AppError('Closing date cannot be before the existing opening date', 400);
    }

    if (data.vacancies !== undefined && data.vacancies <= 0) {
      throw new AppError('Vacancies must be a positive number', 400);
    }

    if (data.unitId || data.departmentId || data.jobRoleId) {
      await this.validateOrgStructure(
        data.unitId || opening.unitId,
        data.departmentId || opening.departmentId || undefined,
        data.jobRoleId || opening.jobRoleId
      );
    }

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: {
        ...data,
        updatedById: userId
      },
      include: { unit: true, department: true, jobRole: true }
    });

    await createAuditLog({
      action: 'JOB_OPENING_UPDATED',
      actorUserId: userId,
      entityType: 'JobOpening',
      entityId: updated.id,
      metadata: { referenceNumber: updated.referenceNumber, fields: Object.keys(data) }
    });

    return updated;
  }

  static async changeStatus(id: string, status: JobOpeningStatus, userId: string) {
    const opening = await prisma.jobOpening.findUnique({ where: { id } });
    if (!opening) throw new JobOpeningNotFoundError();

    const data: Prisma.JobOpeningUpdateInput = {
      status,
      updatedById: userId
    };

    if (status === JobOpeningStatus.OPEN && opening.status !== JobOpeningStatus.OPEN) {
      data.publishedAt = new Date();
    } else if ((status === JobOpeningStatus.CLOSED || status === JobOpeningStatus.FILLED) && !opening.closedAt) {
      data.closedAt = new Date();
    }

    const updated = await prisma.jobOpening.update({
      where: { id },
      data
    });

    await createAuditLog({
      action: `JOB_OPENING_${status}`,
      actorUserId: userId,
      entityType: 'JobOpening',
      entityId: updated.id,
      metadata: { referenceNumber: updated.referenceNumber, oldStatus: opening.status, newStatus: status }
    });

    return updated;
  }

  static async getJobOpeningById(id: string) {
    const opening = await prisma.jobOpening.findUnique({
      where: { id },
      include: { unit: true, department: true, jobRole: true, _count: { select: { applications: true } } }
    });
    if (!opening) throw new JobOpeningNotFoundError();
    return opening;
  }

  static async getJobOpeningBySlug(slug: string, publicOnly: boolean = false) {
    const opening = await prisma.jobOpening.findUnique({
      where: { slug },
      include: { unit: true, department: true, jobRole: true }
    });
    if (!opening) throw new JobOpeningNotFoundError();
    
    // Public visitors only see an opening that is accepting applications now —
    // an OPEN opening past its closing date used to stay reachable by its link.
    if (publicOnly && !isAcceptingApplications(opening)) {
       throw new JobOpeningNotFoundError();
    }
    
    return opening;
  }

  static async listJobOpenings(filters: { status?: JobOpeningStatus, search?: string }, pagination: { page: number, limit: number }, publicOnly: boolean = false) {
    const where: Prisma.JobOpeningWhereInput = {};

    if (publicOnly) {
      Object.assign(where, acceptingApplicationsWhere());
    } else if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { referenceNumber: { contains: filters.search } },
      ];
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      prisma.jobOpening.findMany({
        where,
        skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: { unit: true, department: true, jobRole: true, _count: { select: { applications: true } } }
      }),
      prisma.jobOpening.count({ where })
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  /**
   * The public Careers directory: EVERY active Job Role (the official positions
   * in Hospicio's structure), each with the openings that are accepting
   * applications now. A role with no such opening is still listed — it is a
   * position, not a vacancy — and nothing can be applied for without a real
   * opening. Only public-safe fields: no ids, codes, hierarchy, supervisors,
   * permissions or headcounts. Hiring roles first, then alphabetical.
   */
  /**
   * The public Careers list: ONLY openings that are accepting applications now
   * (OPEN, opening date reached, closing date not passed). Drafts, closed,
   * filled and archived openings are never listed, and a job role without an
   * opening is not shown at all — Careers is for actual vacancies.
   */
  static async listPublicPositions() {
    const openings = await prisma.jobOpening.findMany({
      where: acceptingApplicationsWhere(),
      orderBy: [{ closingDate: 'asc' }, { title: 'asc' }],
      select: {
        slug: true,
        title: true,
        employmentType: true,
        vacancies: true,
        openingDate: true,
        closingDate: true,
        unit: { select: { name: true } },
        department: { select: { name: true } },
        jobRole: { select: { title: true } },
      },
    });
    return {
      openings: openings.map((o) => ({
        slug: o.slug,
        title: o.title,
        position: o.jobRole.title,
        employmentType: o.employmentType,
        vacancies: o.vacancies,
        openingDate: o.openingDate,
        closingDate: o.closingDate,
        unit: o.unit.name,
        department: o.department?.name ?? null,
      })),
      counts: { open: openings.length },
    };
  }

  static async getOverviewStats() {
    const [activeOpenings, totalApplications, applicationsByStatus] = await Promise.all([
      prisma.jobOpening.count({ where: { status: JobOpeningStatus.OPEN } }),
      prisma.jobApplication.count(),
      prisma.jobApplication.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    const stats = {
      activeOpenings,
      totalApplications,
      underReview: 0,
      forInterview: 0,
      hired: 0,
      rejectedOrWithdrawn: 0
    };

    applicationsByStatus.forEach(item => {
      if (item.status === 'UNDER_REVIEW' || item.status === 'SUBMITTED' || item.status === 'SHORTLISTED') {
        stats.underReview += item._count.status;
      } else if (item.status === 'FOR_INTERVIEW' || item.status === 'INTERVIEWED' || item.status === 'FOR_REQUIREMENTS') {
        stats.forInterview += item._count.status;
      } else if (item.status === 'HIRED') {
        stats.hired += item._count.status;
      } else if (item.status === 'REJECTED' || item.status === 'WITHDRAWN') {
        stats.rejectedOrWithdrawn += item._count.status;
      }
    });

    return stats;
  }
}
