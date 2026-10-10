import { api } from '@/services/api';

export interface ShiftDefinition {
  id: string;
  name: string;
  description: string | null;
  category: 'OFFICE' | 'SHIFT';
  startTime: string;
  endTime: string;
  isActive: boolean;
  version: number;
}

export interface EmployeeWeeklyScheduleShift {
  id?: string;
  shiftId: string;
  sequence: number;
  shift?: ShiftDefinition;
}

export interface EmployeeWeeklyScheduleDay {
  id?: string;
  dayOfWeek: string;
  status: 'WORKING' | 'DAY_OFF' | 'UNCONFIGURED';
  shifts: EmployeeWeeklyScheduleShift[];
}

export interface EmployeeWeeklySchedule {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  days: EmployeeWeeklyScheduleDay[];
}

export const weeklyScheduleApi = {
  listShifts: async (): Promise<ShiftDefinition[]> => {
    const res = await api.get('/weekly-schedules/shifts');
    return res.data.data;
  },

  createShift: async (data: Partial<ShiftDefinition>): Promise<ShiftDefinition> => {
    const res = await api.post('/weekly-schedules/shifts', data);
    return res.data.data;
  },

  updateShift: async (id: string, data: Partial<ShiftDefinition>): Promise<ShiftDefinition> => {
    const res = await api.put(`/weekly-schedules/shifts/${id}`, data);
    return res.data.data;
  },

  deactivateShift: async (id: string): Promise<void> => {
    await api.delete(`/weekly-schedules/shifts/${id}`);
  },

  getEmployeeWeeklySchedule: async (employeeId: string, applicableDate: string): Promise<EmployeeWeeklySchedule | null> => {
    const res = await api.get(`/weekly-schedules/employees/${employeeId}`, {
      params: { applicableDate }
    });
    return res.data.data;
  },

  saveEmployeeWeeklySchedule: async (employeeId: string, effectiveFrom: string, days: EmployeeWeeklyScheduleDay[]): Promise<EmployeeWeeklySchedule> => {
    const res = await api.post(`/weekly-schedules/employees/${employeeId}`, {
      effectiveFrom,
      days
    });
    return res.data.data;
  }
};
