import { calendarEntryAppliesToUnit } from '../lib/calendar-scope';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { PermissionTier } from '@prisma/client';
import { OrgHierarchyService } from './org-hierarchy.service';

export class ScheduleService {
  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new Schedule Template
   */
  static async createTemplate(data: any, actorUserId: string) {
    const existing = await prisma.scheduleTemplate.findFirst({
      where: { name: data.name }
    });
    
    if (existing) {
      throw new AppError('A schedule template with this name already exists.', 400);
    }

    // A template with no day rows cannot describe a working week. It was
    // previously possible to create one (`data.days.map` accepts an empty
    // array), and six such templates exist in the live database — every
    // employee assigned to one resolves to "Needs Setup" because the resolver
    // correctly refuses to infer working days from a template's name.
    // Reject the shape at the source so no further empty templates are created.
    const WEEKDAYS = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];
    const days = Array.isArray(data.days) ? data.days : [];
    const providedDays = new Set(days.map((d: any) => String(d?.dayOfWeek)));
    const missing = WEEKDAYS.filter((d) => !providedDays.has(d));
    if (missing.length > 0) {
      throw new AppError(
        `A schedule template must define all seven days of the week. Missing: ${missing.join(', ')}.`,
        400
      );
    }

    const template = await prisma.scheduleTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        createdById: actorUserId,
        days: {
          create: data.days.map((d: any) => ({
            dayOfWeek: d.dayOfWeek,
            isWorking: d.isWorking,
            startTime: d.startTime,
            endTime: d.endTime
          }))
        }
      },
      include: { days: true }
    });

    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: 'TEMPLATE_CREATED',
        newValue: { id: template.id, name: template.name, days: template.days },
        remarks: `Created new schedule template: ${template.name}`,
      }
    });

    return template;
  }

  /**
   * Edit a Template (Creates a new Version to preserve historical assignment integrity)
   */
  static async updateTemplate(id: string, data: any, effectiveDate: string, actorUserId: string) {
    const v1 = await prisma.scheduleTemplate.findUnique({
      where: { id },
      include: { days: true }
    });

    if (!v1) throw new AppError('Template not found', 404);
    if (v1.isArchived) throw new AppError('Cannot edit an archived template', 400);

    const effDateObj = new Date(effectiveDate);

    // Create v2
    const v2 = await prisma.scheduleTemplate.create({
      data: {
        name: data.name || v1.name,
        description: data.description !== undefined ? data.description : v1.description,
        version: v1.version + 1,
        createdById: actorUserId,
        days: {
          create: data.days ? data.days.map((d: any) => ({
            dayOfWeek: d.dayOfWeek,
            isWorking: d.isWorking,
            startTime: d.startTime,
            endTime: d.endTime
          })) : v1.days.map((d: any) => ({
            dayOfWeek: d.dayOfWeek,
            isWorking: d.isWorking,
            startTime: d.startTime,
            endTime: d.endTime
          }))
        }
      },
      include: { days: true }
    });

    // Archive v1
    await prisma.scheduleTemplate.update({
      where: { id: v1.id },
      data: { isArchived: true }
    });

    // Handle Active Assignments:
    // Close v1 assignments, open v2 assignments.
    const activeAssignments = await prisma.employeeScheduleAssignment.findMany({
      where: {
        scheduleTemplateId: v1.id,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: effDateObj } }
        ]
      }
    });

    const batchId = `BATCH-REVISION-${Date.now()}`;

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      for (const assignment of activeAssignments) {
        // Close old assignment
        await tx.employeeScheduleAssignment.update({
          where: { id: assignment.id },
          data: { effectiveTo: effDateObj }
        });

        // Open new assignment
        await tx.employeeScheduleAssignment.create({
          data: {
            employeeId: assignment.employeeId,
            scheduleTemplateId: v2.id,
            effectiveFrom: effDateObj,
            effectiveTo: null,
            assignedByUserId: actorUserId,
            bulkBatchId: batchId
          }
        });
      }
    });

    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: 'TEMPLATE_REVISED',
        previousValue: { id: v1.id, version: v1.version, name: v1.name },
        newValue: { id: v2.id, version: v2.version, name: v2.name, effectiveDate },
        remarks: `Revised template ${v1.name} (v${v1.version} -> v${v2.version})`,
        bulkBatchId: batchId
      }
    });

    return v2;
  }

  static async listTemplates(actorUserId: string, includeCounts: boolean = false) {
    const templates = await prisma.scheduleTemplate.findMany({
      where: { isArchived: false },
      include: { 
        days: true,
        ...(includeCounts ? {
          _count: {
            select: {
              assignments: {
                where: {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gt: new Date() } }
                  ]
                }
              }
            }
          }
        } : {})
      },
      orderBy: { name: 'asc' }
    });

    return templates.map(t => ({
      ...t,
      activeAssignmentsCount: (t as any)._count?.assignments || 0
    }));
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // READ DATA (EMPLOYEES, OVERRIDES, HISTORY)
  // ─────────────────────────────────────────────────────────────────────────────

  static async getEmployeeSchedules(
    context: { userId: string, permissionTier: PermissionTier, employee?: any },
    params: {
      employeeId?: string;
      search?: string;
      unitId?: string;
      departmentId?: string;
      jobRoleId?: string;
      templateId?: string;
      configurationStatus?: string;
      applicableDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = { employmentState: 'ACTIVE', deletedAt: null };
    
    // Auth filter
    if (context.permissionTier === PermissionTier.SUPERVISOR && context.employee) {
      // Canonical hierarchy: self + direct reports (see OrgHierarchyService).
      whereClause.id = { in: await OrgHierarchyService.getTeamScopeIds(context.employee.id) };
    } else if (context.permissionTier === PermissionTier.STANDARD) {
      if (context.employee) {
        whereClause.id = context.employee.id;
      } else {
        throw new AppError('Permission denied', 403);
      }
    }

    if (params.employeeId) {
      if (whereClause.id && typeof whereClause.id === 'object' && whereClause.id.in) {
        if (!whereClause.id.in.includes(params.employeeId) && params.employeeId !== context.employee?.id) {
          throw new AppError('Permission denied: cannot access this employee schedule.', 403);
        }
      } else if (whereClause.id && whereClause.id !== params.employeeId) {
        throw new AppError('Permission denied: cannot access this employee schedule.', 403);
      }
      whereClause.id = params.employeeId;
    }

    if (params.unitId) whereClause.unitId = params.unitId;
    if (params.departmentId) whereClause.departmentId = params.departmentId;
    if (params.jobRoleId) whereClause.jobRoleId = params.jobRoleId;
    if (params.search) {
      whereClause.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { employeeNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const targetDate = params.applicableDate ? new Date(params.applicableDate) : new Date();

    const allEmployees = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        unit: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobRole: { select: { title: true } },
        scheduleAssignments: {
          where: {
            effectiveFrom: { lte: targetDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: targetDate } }
            ]
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            scheduleTemplate: {
              include: { days: true }
            }
          }
        },
        weeklySchedules: {
          where: {
            effectiveFrom: { lte: targetDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: targetDate } }
            ]
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: { days: { include: { shifts: { include: { shift: true } } } } }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    let filtered = allEmployees.map(emp => {
      const activeWeekly = (emp as any).weeklySchedules?.[0] || null;
      const activeAssignment = emp.scheduleAssignments?.[0] || null;
      
      let configurationStatus = 'NO_SCHEDULE';
      let currentTemplate = null;
      let effectiveFrom = null;
      let effectiveTo = null;

      if (activeWeekly) {
         effectiveFrom = activeWeekly.effectiveFrom;
         effectiveTo = activeWeekly.effectiveTo;
         
         let dynamicName = 'Dynamic Weekly Schedule';
         if (activeWeekly.days && activeWeekly.days.length > 0) {
            const shiftCounts: Record<string, { count: number, shifts: any[] }> = {};
            let workingDays = 0;
            for (const d of activeWeekly.days) {
              if (d.status === 'WORKING') {
                 workingDays++;
                 if (d.shifts && d.shifts.length > 0) {
                   const key = d.shifts.map((s: any) => s.shift?.id || '').join(',');
                   if (!shiftCounts[key]) shiftCounts[key] = { count: 0, shifts: d.shifts.map((s:any) => s.shift).filter(Boolean) };
                   shiftCounts[key].count++;
                 }
              }
            }
            let bestKey = null;
            let bestCount = 0;
            for (const [key, data] of Object.entries(shiftCounts)) {
               if (data.count > bestCount) {
                 bestCount = data.count;
                 bestKey = key;
               }
            }
            if (bestKey && bestCount >= 2 && bestCount >= workingDays / 2) {
               const shiftsArr = shiftCounts[bestKey].shifts;
               if (shiftsArr.length === 1) {
                 dynamicName = shiftsArr[0].name;
               } else if (shiftsArr.length > 1) {
                 dynamicName = `${shiftsArr[0].name} +${shiftsArr.length - 1} more`;
               }
            } else if (workingDays > 0) {
               dynamicName = 'Mixed Schedule';
            }
         }
         
         currentTemplate = { id: activeWeekly.id, name: dynamicName, version: 1 };
         if (activeWeekly.days && activeWeekly.days.length === 7 && !activeWeekly.days.some((d: any) => d.status === 'UNCONFIGURED')) {
           configurationStatus = 'CONFIGURED';
         } else {
           configurationStatus = 'PARTIALLY_CONFIGURED';
         }
      } else if (activeAssignment && activeAssignment.scheduleTemplate) {
        effectiveFrom = activeAssignment.effectiveFrom;
        effectiveTo = activeAssignment.effectiveTo;
        currentTemplate = activeAssignment.scheduleTemplate;
        if (currentTemplate.days && currentTemplate.days.length === 7 && !currentTemplate.days.some((d: any) => !d.isWorking && d.startTime === null)) {
          configurationStatus = 'CONFIGURED';
        } else {
          configurationStatus = 'PARTIALLY_CONFIGURED';
        }
      }

      return {
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        name: [emp.firstName, emp.lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ") || "Unnamed employee",
        unit: emp.unit,
        department: emp.department,
        jobRole: emp.jobRole?.title || 'Unknown Role',
        currentTemplate,
        configurationStatus,
        effectiveFrom: activeAssignment?.effectiveFrom || null,
        effectiveTo: activeAssignment?.effectiveTo || null,
      };
    });

    if (params.templateId) {
      filtered = filtered.filter(f => f.currentTemplate?.id === params.templateId);
    }
    if (params.configurationStatus) {
      filtered = filtered.filter(f => f.configurationStatus === params.configurationStatus);
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return { data: paginated, total, page, limit };
  }

  static async getCoverage(
    context: { userId: string, permissionTier: PermissionTier, employee?: any },
    params: {
      startDate: string;
      endDate: string;
      search?: string;
      unitId?: string;
      departmentId?: string;
      templateId?: string;
    }
  ) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid startDate or endDate', 400);
    }
    
    // Date range cap of 31 days
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 0) throw new AppError('startDate must be before or equal to endDate', 400);
    if (diffDays > 31) throw new AppError('Date range cannot exceed 31 days', 400);

    const whereClause: any = { employmentState: 'ACTIVE', deletedAt: null };
    
    if (context.permissionTier === PermissionTier.SUPERVISOR && context.employee) {
      // Canonical hierarchy: self + direct reports (see OrgHierarchyService).
      whereClause.id = { in: await OrgHierarchyService.getTeamScopeIds(context.employee.id) };
    } else if (context.permissionTier === PermissionTier.STANDARD) {
      throw new AppError('Permission denied: STANDARD users cannot access schedule coverage.', 403);
    }

    if (params.unitId) whereClause.unitId = params.unitId;
    if (params.departmentId) whereClause.departmentId = params.departmentId;
    if (params.search) {
      whereClause.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { employeeNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [employees, orgEvents] = await Promise.all([
      prisma.employee.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          unitId: true,
          unit: { select: { id: true, name: true } },
          scheduleAssignments: {
            where: {
              effectiveFrom: { lte: end },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gt: start } }
              ]
            },
            orderBy: { effectiveFrom: 'desc' },
            include: {
              scheduleTemplate: {
                include: { days: true }
              }
            }
          }
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      }),
      prisma.organizationCalendarEntry.findMany({
        where: {
          date: { gte: start, lte: end },
          status: 'APPROVED',
        },
        include: { workingUnits: { include: { unit: { select: { name: true } } } } },
      })
    ]);
    
    const orgEventsByDate = new Map<string, any[]>();
    for (const e of orgEvents) {
      const dStr = e.date.toISOString().split('T')[0];
      if (!orgEventsByDate.has(dStr)) orgEventsByDate.set(dStr, []);
      orgEventsByDate.get(dStr)!.push(e);
    }

    const coverage = [];
    const loopEnd = new Date(end);
    loopEnd.setDate(loopEnd.getDate() + 1);
    
    const weekdayMapping = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    let filteredEmployees = employees;
    if (params.templateId) {
      // In coverage view, filtering by templateId means they must have that template active at some point in the range
      filteredEmployees = employees.filter(emp => emp.scheduleAssignments.some(a => a.scheduleTemplateId === params.templateId));
    }

    for (const emp of filteredEmployees) {
      const dailySchedules = [];
      let empWorkingCount = 0;
      let empDayOffCount = 0;
      let empUnconfiguredCount = 0;
      let empNoScheduleCount = 0;
      
      let curr = new Date(start);
      while (curr < loopEnd) {
        const dStr = curr.toISOString().split('T')[0];
        const dayOfWeek = weekdayMapping[curr.getDay()] as any;
        
        const assignment = emp.scheduleAssignments.find(a => 
          new Date(a.effectiveFrom) <= curr && (!a.effectiveTo || new Date(a.effectiveTo) > curr)
        );

        let status = 'NO_SCHEDULE';
        let startTime = null;
        let endTime = null;
        let template = null;
        let isWorkingDay = false;

        if (assignment && assignment.scheduleTemplate) {
          template = { id: assignment.scheduleTemplate.id, name: assignment.scheduleTemplate.name, version: assignment.scheduleTemplate.version };
          
          if (assignment.scheduleTemplate.days && assignment.scheduleTemplate.days.length > 0) {
            const templateDay = assignment.scheduleTemplate.days.find(d => d.dayOfWeek === dayOfWeek);
            if (templateDay) {
              isWorkingDay = templateDay.isWorking;
              status = isWorkingDay ? 'WORKING' : 'DAY_OFF';
              startTime = templateDay.startTime;
              endTime = templateDay.endTime;
            } else {
              status = 'UNCONFIGURED'; // Should not happen in a valid template, but fallback
            }
          } else {
            status = 'UNCONFIGURED';
          }
        }

        if (status === 'WORKING') empWorkingCount++;
        else if (status === 'DAY_OFF') empDayOffCount++;
        else if (status === 'UNCONFIGURED') empUnconfiguredCount++;
        else empNoScheduleCount++;

        dailySchedules.push({
          date: dStr,
          status,
          startTime,
          endTime,
          template,
          // Each entry says whether it applies to this employee's unit.
          orgEvents: (orgEventsByDate.get(dStr) || []).map((e: any) => ({
            ...e,
            appliesToEmployee: calendarEntryAppliesToUnit(e, emp.unitId),
            workingUnits: (e.workingUnits ?? []).map((w: any) => w.unit?.name).filter(Boolean),
          }))
        });

        curr.setDate(curr.getDate() + 1);
      }

      coverage.push({
        employee: {
          id: emp.id,
          name: [emp.firstName, emp.lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ") || "Unnamed employee",
          employeeNumber: emp.employeeNumber,
          unit: emp.unit
        },
        dailySchedules,
        summary: {
          working: empWorkingCount,
          dayOff: empDayOffCount,
          unconfigured: empUnconfiguredCount,
          noSchedule: empNoScheduleCount
        }
      });
    }

    return { coverage, startDate: params.startDate, endDate: params.endDate };
  }



  static async listHistory(context: { userId: string, permissionTier: PermissionTier, employee?: any }, params?: { employeeId?: string }) {
    const whereClause: any = {};
    if (context.permissionTier === PermissionTier.SUPERVISOR && context.employee) {
      // Canonical hierarchy: self + direct reports (see OrgHierarchyService).
      whereClause.targetEmployeeId = {
        in: await OrgHierarchyService.getTeamScopeIds(context.employee.id),
      };
    } else if (context.permissionTier === PermissionTier.STANDARD) {
      if (context.employee) {
        whereClause.targetEmployeeId = context.employee.id;
      } else {
        throw new AppError('Permission denied', 403);
      }
    }

    if (params?.employeeId) {
      if (whereClause.targetEmployeeId && typeof whereClause.targetEmployeeId === 'object' && whereClause.targetEmployeeId.in) {
        if (!whereClause.targetEmployeeId.in.includes(params.employeeId) && params.employeeId !== context.employee?.id) {
          throw new AppError('Permission denied: cannot access this employee history.', 403);
        }
      } else if (whereClause.targetEmployeeId && whereClause.targetEmployeeId !== params.employeeId) {
        throw new AppError('Permission denied: cannot access this employee history.', 403);
      }
      whereClause.targetEmployeeId = params.employeeId;
    }

    return prisma.scheduleHistoryLog.findMany({
      where: whereClause,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        user: { select: { email: true, employee: { select: { firstName: true, lastName: true, jobRole: { select: { title: true } } } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ASSIGNMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assign a schedule template to employees (Single or Bulk)
   */
  static async assignSchedule(employeeIds: string[], templateId: string, effectiveDate: string, actorUserId: string) {
    const template = await prisma.scheduleTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new AppError('Template not found', 404);
    if (template.isArchived) throw new AppError('Cannot assign an archived template', 400);

    const effDateObj = new Date(effectiveDate);
    const batchId = `BATCH-ASSIGN-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      for (const empId of employeeIds) {
        // Find current active assignment
        const currentActive = await tx.employeeScheduleAssignment.findFirst({
          where: {
            employeeId: empId,
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gt: effDateObj } }
            ]
          },
          orderBy: { effectiveFrom: 'desc' }
        });

        if (currentActive) {
          // Close it at the boundary
          await tx.employeeScheduleAssignment.update({
            where: { id: currentActive.id },
            data: { effectiveTo: effDateObj }
          });
        }

        // Create new
        await tx.employeeScheduleAssignment.create({
          data: {
            employeeId: empId,
            scheduleTemplateId: template.id,
            effectiveFrom: effDateObj,
            effectiveTo: null,
            assignedByUserId: actorUserId,
            bulkBatchId: batchId
          }
        });

        // Audit for each employee
        await tx.scheduleHistoryLog.create({
          data: {
            targetEmployeeId: empId,
            actorUserId,
            action: 'TEMPLATE_ASSIGNED',
            previousValue: currentActive ? { templateId: currentActive.scheduleTemplateId } : undefined,
            newValue: { templateId: template.id, effectiveDate },
            remarks: `Assigned template: ${template.name}`,
            bulkBatchId: batchId
          }
        });
      }
    });

    return { success: true, count: employeeIds.length };
  }

  // ─────────────────────────────────────────────────────────────────────────────

  // HISTORICAL DATE RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the composite schedule parameters for a specific employee on a specific date.
   * Returns separate dimensions for Organization Calendar, Assignments, and Overrides.
   */
    static async resolveScheduleForDate(employeeId: string, date: string | Date) {
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    const weekdayMapping = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = weekdayMapping[targetDate.getDay()] as any;

    // 1. Organization Calendar Context — and whether it applies to this
    //    employee's unit (HR may mark units that work on the day).
    const [holiday, employeeUnit] = await Promise.all([
      prisma.organizationCalendarEntry.findFirst({
        where: { date: targetDate, status: 'APPROVED' },
        include: { workingUnits: { include: { unit: { select: { name: true } } } } },
      }),
      prisma.employee.findUnique({ where: { id: employeeId }, select: { unitId: true } }),
    ]);

    // 2. Try NEW EmployeeWeeklySchedule
    const weeklySchedule = await prisma.employeeWeeklySchedule.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }]
      },
      include: {
        days: {
          where: { dayOfWeek },
          include: {
            shifts: {
              include: { shift: true },
              orderBy: { sequence: 'asc' }
            }
          }
        }
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    let effectiveEmployeeSchedule: any = null;
    let assignment = null;
    let templateDay = null;

    if (weeklySchedule) {
      const dayConfig = weeklySchedule.days[0];
      if (!dayConfig || dayConfig.status === 'UNCONFIGURED') {
        effectiveEmployeeSchedule = {
          type: 'UNCONFIGURED',
          status: 'UNCONFIGURED',
          isWorkingDay: false,
          source: 'NEW_WEEKLY_SCHEDULE',
          effectiveScheduleId: weeklySchedule.id,
          shifts: []
        };
      } else if (dayConfig.status === 'DAY_OFF') {
        effectiveEmployeeSchedule = {
          type: 'DAY_OFF',
          status: 'DAY_OFF',
          isWorkingDay: false,
          source: 'NEW_WEEKLY_SCHEDULE',
          effectiveScheduleId: weeklySchedule.id,
          shifts: []
        };
      } else if (dayConfig.status === 'WORKING') {
        effectiveEmployeeSchedule = {
          type: 'WORKING',
          status: 'WORKING',
          isWorkingDay: true,
          source: 'NEW_WEEKLY_SCHEDULE',
          effectiveScheduleId: weeklySchedule.id,
          shifts: dayConfig.shifts.map(s => {
            const crossesMidnight = s.shift.endTime < s.shift.startTime;
            return {
              id: s.shift.id,
              name: s.shift.name,
              startTime: s.shift.startTime,
              endTime: s.shift.endTime,
              crossesMidnight
            };
          })
        };
      }
    } else {
      // 3. Fallback to Legacy EmployeeScheduleAssignment
      assignment = await prisma.employeeScheduleAssignment.findFirst({
        where: {
          employeeId,
          effectiveFrom: { lte: targetDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }]
        },
        include: {
          scheduleTemplate: {
            include: { days: { where: { dayOfWeek } } }
          }
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (assignment) {
        templateDay = assignment.scheduleTemplate.days?.[0] || null;
        if (templateDay) {
          if (templateDay.isWorking) {
            const crossesMidnight = templateDay.startTime && templateDay.endTime && templateDay.endTime < templateDay.startTime;
            effectiveEmployeeSchedule = {
              type: 'TEMPLATE_CONFIGURED',
              status: 'WORKING',
              isWorkingDay: true,
              source: 'LEGACY_ASSIGNMENT',
              effectiveScheduleId: assignment.id,
              shifts: [{
                id: 'legacy',
                name: assignment.scheduleTemplate.name,
                startTime: templateDay.startTime,
                endTime: templateDay.endTime,
                crossesMidnight
              }]
            };
          } else {
            effectiveEmployeeSchedule = {
              type: 'TEMPLATE_CONFIGURED',
              status: 'DAY_OFF',
              isWorkingDay: false,
              source: 'LEGACY_ASSIGNMENT',
              effectiveScheduleId: assignment.id,
              shifts: []
            };
          }
        } else {
          effectiveEmployeeSchedule = {
            type: 'UNCONFIGURED',
            status: 'UNCONFIGURED',
            isWorkingDay: false,
            source: 'LEGACY_ASSIGNMENT',
            effectiveScheduleId: assignment.id,
            shifts: []
          };
        }
      }
    }

    if (!effectiveEmployeeSchedule) {
      effectiveEmployeeSchedule = {
        type: 'NO_SCHEDULE',
        status: 'NO_SCHEDULE',
        isWorkingDay: false,
        source: null,
        effectiveScheduleId: null,
        shifts: []
      };
    }

    return {
      state: effectiveEmployeeSchedule.status,
      employeeId,
      date: targetDate,
      weekday: dayOfWeek,
      shifts: effectiveEmployeeSchedule.shifts,
      source: effectiveEmployeeSchedule.source,
      effectiveScheduleId: effectiveEmployeeSchedule.effectiveScheduleId,
      effectiveFrom: weeklySchedule?.effectiveFrom || assignment?.effectiveFrom || null,
      effectiveTo: weeklySchedule?.effectiveTo || assignment?.effectiveTo || null,
      organizationContext: holiday ? {
        entryId: holiday.id,
        type: holiday.type,
        name: holiday.name,
        status: holiday.status,
        source: holiday.source,
        // False when the employee's unit is one HR marked as working that day:
        // their schedule stands and the day is not a holiday for them.
        appliesToEmployee: calendarEntryAppliesToUnit(holiday, employeeUnit?.unitId),
        workingUnits: holiday.workingUnits.map((w) => w.unit.name),
      } : null,
      // Keep legacy returns for backwards compatibility with anything expecting it
      scheduleAssignment: assignment ? {
        assignmentId: assignment.id,
        templateId: assignment.scheduleTemplate.id,
        templateName: assignment.scheduleTemplate.name,
        templateVersion: assignment.scheduleTemplate.version,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo
      } : null,
      templateDay: templateDay ? {
        weekday: templateDay.dayOfWeek,
        isWorkingDay: templateDay.isWorking,
        startTime: templateDay.startTime,
        endTime: templateDay.endTime
      } : null,
      effectiveEmployeeSchedule
    };
  }
}
