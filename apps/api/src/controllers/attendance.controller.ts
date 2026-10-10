import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { createAuditLog } from '../lib/audit';

export class AttendanceController {

  static async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const { start, end, scope, unitId, departmentId, employeeId, status } = req.query;
      const result = await AttendanceService.getCalendar(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          start: start as string,
          end: end as string,
          scope: scope as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          employeeId: employeeId as string,
          status: status as string,
        }
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, employeeId, startDate, endDate, status, unitId, departmentId, scheduleTemplateId, recordAvailability } = req.query;
      const result = await AttendanceService.list(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 30,
          employeeId: employeeId as string,
          startDate: startDate as string,
          endDate: endDate as string,
          status: status as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          scheduleTemplateId: scheduleTemplateId as string,
          recordAvailability: recordAvailability as string,
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, employeeId, unitId, departmentId, search } = req.query;
      const result = await AttendanceService.getSchedules(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 50,
          employeeId: employeeId as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          search: search as string,
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, employeeId, startDate, endDate, logType } = req.query;
      const result = await AttendanceService.getLogs(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 30,
          employeeId: employeeId as string,
          startDate: startDate as string,
          endDate: endDate as string,
          logType: logType as string,
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { before, after, record } = await AttendanceService.update(
        req.params.id,
        req.body,
        req.user!.userId
      );

      // BOTH sides are recorded. Previously only `newValue` was written, so a
      // correction could never be reconstructed — `AuditLog.oldValue` existed and
      // was simply left unpopulated.
      await createAuditLog({
        userId: req.user!.userId,
        action: 'UPDATE_ATTENDANCE',
        resource: 'AttendanceRecord',
        resourceId: req.params.id,
        oldValue: before,
        newValue: after,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }

  static async getTodaySummary(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await AttendanceService.getTodaySummary();
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async getTally(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, startDate, endDate, employeeId, unitId, departmentId, search } = req.query;
      const result = await AttendanceService.getTally(
        (req.user!.employeeId || ''),
        req.user!.permissionTier,
        {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 50,
          startDate: startDate as string,
          endDate: endDate as string,
          employeeId: employeeId as string,
          unitId: unitId as string,
          departmentId: departmentId as string,
          search: search as string,
        }
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async exportExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const params = { ...req.query, ...req.body };
      const buffer = await AttendanceService.exportExcel(req.user!.employeeId || '', req.user!.permissionTier, params);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Attendance_Report_${Date.now()}.xlsx"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }

  static async exportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const params = { ...req.query, ...req.body };
      const buffer = await AttendanceService.exportPDF(req.user!.employeeId || '', req.user!.permissionTier, params);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Attendance_Report_${Date.now()}.pdf"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
