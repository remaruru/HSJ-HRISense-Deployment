import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { ScheduleValidator } from '../utils/schedule-validator.util';

export class WeeklyScheduleService {
  // ─────────────────────────────────────────────────────────────────────────────
  // SHIFT DEFINITIONS (CATALOG)
  // ─────────────────────────────────────────────────────────────────────────────

  static async listShifts() {
    return prisma.shiftDefinition.findMany({
      where: { isActive: true, isArchived: false },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
  }

  static async createShift(data: any, actorUserId: string) {
    const existing = await prisma.shiftDefinition.findFirst({
      where: { name: data.name }
    });
    if (existing) {
      throw new AppError('A shift definition with this name already exists.', 400);
    }

    return prisma.shiftDefinition.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category || 'SHIFT',
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: true,
        version: 1,
        isArchived: false,
        createdById: actorUserId,
      }
    });
  }

  static async updateShift(id: string, data: any, actorUserId: string) {
    const v1 = await prisma.shiftDefinition.findUnique({
      where: { id },
      include: { _count: { select: { weeklyShifts: true } } }
    });

    if (!v1) throw new AppError('Shift definition not found', 404);
    if (v1.isArchived) throw new AppError('Cannot edit an archived shift', 400);

    // If it has NEVER been used, we can mutate it in place
    if (v1._count.weeklyShifts === 0) {
      return prisma.shiftDefinition.update({
        where: { id },
        data: {
          name: data.name || v1.name,
          description: data.description !== undefined ? data.description : v1.description,
          category: data.category || v1.category,
          startTime: data.startTime || v1.startTime,
          endTime: data.endTime || v1.endTime
        }
      });
    }

    // Otherwise, we version it to preserve history
    const v2 = await prisma.shiftDefinition.create({
      data: {
        name: data.name || v1.name,
        description: data.description !== undefined ? data.description : v1.description,
        category: data.category || v1.category,
        startTime: data.startTime || v1.startTime,
        endTime: data.endTime || v1.endTime,
        version: v1.version + 1,
        createdById: actorUserId,
      }
    });

    await prisma.shiftDefinition.update({
      where: { id: v1.id },
      data: { isArchived: true, isActive: false }
    });

    return v2;
  }

  static async deactivateShift(id: string) {
    return prisma.shiftDefinition.update({
      where: { id },
      data: { isActive: false }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPLOYEE WEEKLY SCHEDULES
  // ─────────────────────────────────────────────────────────────────────────────

  static async getEmployeeWeeklySchedule(employeeId: string, applicableDate: string) {
    const targetDate = new Date(applicableDate);
    const schedule = await prisma.employeeWeeklySchedule.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: targetDate } }]
      },
      include: {
        days: {
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
    return schedule;
  }

  static async saveEmployeeWeeklySchedule(employeeId: string, effectiveFrom: string, days: any[], actorUserId: string) {
    const effDateObj = new Date(effectiveFrom);

    // 1. Hydrate shift definitions for validation
    const shiftIds = new Set<string>();
    days.forEach(d => {
      if (d.status === 'WORKING' && Array.isArray(d.shifts)) {
        d.shifts.forEach((s: any) => { if (s.shiftId) shiftIds.add(s.shiftId); });
      }
    });

    const shiftDefinitions = await prisma.shiftDefinition.findMany({
      where: { id: { in: Array.from(shiftIds) } }
    });
    const shiftMap = new Map(shiftDefinitions.map(s => [s.id, s]));

    const hydratedDays = days.map(d => {
      if (d.status !== 'WORKING') return d;
      return {
        ...d,
        shifts: (d.shifts || []).map((s: any) => {
          const def = shiftMap.get(s.shiftId);
          if (!def) throw new AppError(`Shift not found: ${s.shiftId}`, 400);
          return { ...s, startTime: def.startTime, endTime: def.endTime };
        })
      };
    });

    const validation = ScheduleValidator.validateWeeklyShifts(hydratedDays);
    if (!validation.isValid) {
      throw new AppError(validation.error || 'Invalid schedule overlap', 400);
    }

    // Find the active schedule covering (effectiveFrom - 1 day) to check boundary overlap
    const previousDate = new Date(effDateObj);
    previousDate.setDate(previousDate.getDate() - 1);

    const prevSchedule = await prisma.employeeWeeklySchedule.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: previousDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: previousDate } }]
      },
      include: {
        days: {
          include: { shifts: { include: { shift: true } } }
        }
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (prevSchedule) {
      const weekdayMapping = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const prevDayOfWeek = weekdayMapping[previousDate.getDay()];
      const prevDayConfig = prevSchedule.days.find(d => d.dayOfWeek === prevDayOfWeek);
      if (prevDayConfig && prevDayConfig.status === 'WORKING') {
        for (const s of prevDayConfig.shifts) {
          if (s.shift.endTime < s.shift.startTime) {
            // It's an overnight shift crossing into the NEW schedule's effectiveFrom date!
            const newDayOfWeek = weekdayMapping[effDateObj.getDay()];
            const newDayConfig = hydratedDays.find(d => d.dayOfWeek === newDayOfWeek);
            if (newDayConfig && newDayConfig.status === 'WORKING') {
              const boundaryVal = ScheduleValidator.validateBoundaryOverlap(s.shift, newDayConfig.shifts);
              if (!boundaryVal.isValid) {
                throw new AppError(boundaryVal.error || 'Boundary overlap', 400);
              }
            }
          }
        }
      }
    }

    // Find same-date schedule if one exists
    const sameDateSchedule = await prisma.employeeWeeklySchedule.findFirst({
      where: { employeeId, effectiveFrom: effDateObj }
    });

    // Find the NEXT schedule after this date (to correctly bound effectiveTo)
    const nextSchedule = await prisma.employeeWeeklySchedule.findFirst({
      where: { employeeId, effectiveFrom: { gt: effDateObj } },
      orderBy: { effectiveFrom: 'asc' }
    });

    // Using transaction to maintain a contiguous half-open effective timeline
    return prisma.$transaction(async (tx) => {
      // The new schedule runs until the NEXT schedule starts. When there is no
      // later schedule it is open-ended.
      //
      // This value was previously computed and then discarded — the create below
      // hardcoded `effectiveTo: null`. Inserting a schedule BEFORE an existing
      // future one therefore produced two rows that both claimed to cover every
      // date after the later one's start, i.e. two "active" schedules for the
      // same employee-day. Reads happened to survive because lookups order by
      // `effectiveFrom desc`, but the timeline was genuinely ambiguous.
      const newEffectiveTo = nextSchedule ? nextSchedule.effectiveFrom : null;

      if (sameDateSchedule) {
        // Editing an existing scheduled change for this exact date
        await tx.employeeWeeklySchedule.delete({ where: { id: sameDateSchedule.id } });
      } else {
        // Inserting a new change, we must bound the immediately preceding schedule
        const prev = await tx.employeeWeeklySchedule.findFirst({
          where: { employeeId, effectiveFrom: { lt: effDateObj } },
          orderBy: { effectiveFrom: 'desc' }
        });
        if (prev) {
          await tx.employeeWeeklySchedule.update({
            where: { id: prev.id },
            data: { effectiveTo: effDateObj }
          });
        }
      }

      const newSchedule = await tx.employeeWeeklySchedule.create({
        data: {
          employeeId,
          effectiveFrom: effDateObj,
          effectiveTo: newEffectiveTo,
          createdByUserId: actorUserId,
          days: {
            create: days.map(d => ({
              dayOfWeek: d.dayOfWeek,
              status: d.status,
              shifts: d.status === 'WORKING' ? {
                create: (d.shifts || []).map((s: any, idx: number) => ({
                  shiftId: s.shiftId,
                  sequence: idx + 1
                }))
              } : undefined
            }))
          }
        },
        include: { days: { include: { shifts: { include: { shift: true } } } } }
      });

      // Audit Log
      await tx.scheduleHistoryLog.create({
        data: {
          targetEmployeeId: employeeId,
          actorUserId,
          action: 'WEEKLY_SCHEDULE_REVISED',
          remarks: `Revised weekly schedule effective ${effectiveFrom}`
        }
      });

      return newSchedule;
    });
  }
}
