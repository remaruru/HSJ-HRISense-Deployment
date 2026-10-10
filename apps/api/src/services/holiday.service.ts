import axios from 'axios';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { OrganizationCalendarSource, OrganizationCalendarStatus, OrganizationCalendarType, PermissionTier } from '@prisma/client';

export class HolidayService {
  /**
   * Fetch from Nager.Date API and save as PENDING suggestions.
   * Does NOT overwrite manually created or already APPROVED/IGNORED entries.
   */
  static async fetchSuggestions(year: number, actorUserId: string) {

    try {
      // Use Nager.Date API instead of HolidayAPI
      const response = await axios.get(`https://nagerholidays.com/api/v4/Holidays/PH/${year}`);
      
      const holidays = response.data || [];
      const added = [];

      for (const hol of holidays) {
        const dateObj = new Date(hol.date);
        
        // Check if an entry with this date and name already exists
        const existing = await prisma.organizationCalendarEntry.findUnique({
          where: {
            date_name: {
              date: dateObj,
              name: hol.name,
            }
          }
        });

        if (!existing) {
          // It's new, insert as PENDING suggestion
          const newEntry = await prisma.organizationCalendarEntry.create({
            data: {
              date: dateObj,
              name: hol.name,
              type: OrganizationCalendarType.HOLIDAY,
              source: OrganizationCalendarSource.HOLIDAY_API,
              status: OrganizationCalendarStatus.PENDING,
              createdById: actorUserId,
            }
          });
          added.push(newEntry);
        }
      }

      return {
        message: `Successfully fetched suggestions for ${year}. Added ${added.length} new pending holidays.`,
        addedCount: added.length,
      };

    } catch (err: any) {
      console.error('Nager API fetch error:', err.response?.data || err.message);
      const apiError = err.response?.data?.title || err.response?.data?.message || 'Failed to fetch holidays from Nager API.';
      throw new AppError(apiError, 502);
    }
  }

  /**
   * Get all organization calendar entries (optionally filtered by year and status)
   */
  static async list(params: { year?: number; status?: OrganizationCalendarStatus; source?: OrganizationCalendarSource }) {
    const where: any = {};
    
    if (params.year) {
      where.date = {
        gte: new Date(`${params.year}-01-01`),
        lte: new Date(`${params.year}-12-31`),
      };
    }
    if (params.status) {
      where.status = params.status;
    }
    if (params.source) {
      where.source = params.source;
    }

    return prisma.organizationCalendarEntry.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { workingUnits: { include: { unit: { select: { id: true, code: true, name: true } } } } },
    });
  }

  /**
   * Sets the units expected to WORK on a calendar entry (replacing the previous
   * list). Every other unit observes the entry. Only real, active units are
   * accepted — nothing is created or inferred.
   */
  static async setWorkingUnits(id: string, unitIds: string[], actorUserId: string) {
    const entry = await prisma.organizationCalendarEntry.findUnique({
      where: { id },
      include: { workingUnits: { include: { unit: { select: { name: true } } } } },
    });
    if (!entry) throw new AppError('Calendar entry not found', 404);

    const wanted = [...new Set((unitIds ?? []).filter((u) => typeof u === 'string' && u.trim()))];
    const units = wanted.length
      ? await prisma.unit.findMany({ where: { id: { in: wanted }, isActive: true }, select: { id: true, name: true } })
      : [];
    if (units.length !== wanted.length) throw new AppError('One or more selected units do not exist or are inactive.', 400);

    await prisma.$transaction(async (tx) => {
      await tx.organizationCalendarWorkingUnit.deleteMany({ where: { entryId: id } });
      if (units.length) {
        await tx.organizationCalendarWorkingUnit.createMany({
          data: units.map((u) => ({ entryId: id, unitId: u.id, createdById: actorUserId })),
        });
      }
      await tx.scheduleHistoryLog.create({
        data: {
          actorUserId,
          action: 'CALENDAR_ENTRY_WORKING_UNITS_UPDATED',
          previousValue: { workingUnits: entry.workingUnits.map((w) => w.unit.name) },
          newValue: { workingUnits: units.map((u) => u.name) },
          remarks: `Units expected to work on ${entry.name}: ${units.map((u) => u.name).join(', ') || 'none'}`,
        },
      });
    });

    return prisma.organizationCalendarEntry.findUnique({
      where: { id },
      include: { workingUnits: { include: { unit: { select: { id: true, code: true, name: true } } } } },
    });
  }

  /**
   * Approve or Ignore a pending external suggestion (e.g., from Nager.Date)
   */
  static async updateSuggestionStatus(id: string, status: OrganizationCalendarStatus, actorUserId: string) {
    if (status !== OrganizationCalendarStatus.APPROVED && status !== OrganizationCalendarStatus.IGNORED) {
      throw new AppError('Invalid status update for suggestion.', 400);
    }

    const entry = await prisma.organizationCalendarEntry.findUnique({ where: { id } });
    if (!entry) throw new AppError('Calendar entry not found', 404);
    if (entry.source !== OrganizationCalendarSource.HOLIDAY_API) {
      throw new AppError('Only external suggestions can be approved or ignored via this method.', 400);
    }

    const updated = await prisma.organizationCalendarEntry.update({
      where: { id },
      data: { status }
    });

    // Audit log
    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: `HOLIDAY_SUGGESTION_${status}`,
        previousValue: { status: entry.status },
        newValue: { status: updated.status },
        remarks: `Updated external suggestion: ${updated.name}`,
      }
    });

    return updated;
  }

  /**
   * Create a manual organization calendar entry
   */
  static async createManualEntry(data: { date: string; name: string; type: OrganizationCalendarType; notes?: string }, actorUserId: string) {
    const dateObj = new Date(data.date);
    
    const existing = await prisma.organizationCalendarEntry.findUnique({
      where: {
        date_name: { date: dateObj, name: data.name }
      }
    });

    if (existing) {
      throw new AppError('An entry with this date and name already exists.', 409);
    }

    const entry = await prisma.organizationCalendarEntry.create({
      data: {
        date: dateObj,
        name: data.name,
        type: data.type,
        notes: data.notes,
        source: OrganizationCalendarSource.MANUAL,
        status: OrganizationCalendarStatus.APPROVED, // Manual entries are automatically approved
        createdById: actorUserId,
      }
    });

    // Audit log
    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: 'MANUAL_HOLIDAY_CREATED',
        newValue: { id: entry.id, date: entry.date, name: entry.name, type: entry.type },
        remarks: `Created manual calendar entry: ${entry.name}`,
      }
    });

    return entry;
  }

  /**
   * Deactivates a calendar entry.
   *
   * HRISense does NOT hard-delete calendar entries — attendance history is
   * interpreted against them, so removing a row would silently rewrite the past.
   * The entry is marked IGNORED, which takes it out of the active calendar while
   * preserving the record and its audit trail.
   */
  static async deactivateEntry(id: string, actorUserId: string, remarks?: string) {
    const entry = await prisma.organizationCalendarEntry.findUnique({ where: { id } });
    if (!entry) throw new AppError('Calendar entry not found', 404);

    if (entry.status === 'IGNORED') {
      return entry;
    }

    const updated = await prisma.organizationCalendarEntry.update({
      where: { id },
      data: { status: 'IGNORED' },
    });

    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: 'CALENDAR_ENTRY_DEACTIVATED',
        previousValue: { name: entry.name, type: entry.type, status: entry.status, date: entry.date },
        newValue: { status: updated.status },
        remarks: remarks || `Deactivated calendar entry: ${entry.name}`,
      },
    });

    return updated;
  }

  /**
   * Update a calendar entry's details.
   */
  static async updateManualEntry(id: string, data: { name?: string; type?: OrganizationCalendarType; notes?: string; status?: OrganizationCalendarStatus }, actorUserId: string) {
    const entry = await prisma.organizationCalendarEntry.findUnique({ where: { id } });
    if (!entry) throw new AppError('Calendar entry not found', 404);

    const updated = await prisma.organizationCalendarEntry.update({
      where: { id },
      data
    });

    // Audit log
    await prisma.scheduleHistoryLog.create({
      data: {
        actorUserId,
        action: 'CALENDAR_ENTRY_UPDATED',
        previousValue: { name: entry.name, type: entry.type, status: entry.status },
        newValue: { name: updated.name, type: updated.type, status: updated.status },
        remarks: `Updated calendar entry: ${updated.name}`,
      }
    });

    return updated;
  }
}
