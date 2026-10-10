import { api } from '@/services/api';

export interface ScheduleTemplateDay {
  id?: string;
  dayOfWeek: string;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  isArchived: boolean;
  days: ScheduleTemplateDay[];
  activeAssignmentsCount?: number;
}

export interface EmployeeScheduleAssignment {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  scheduleTemplate: ScheduleTemplate;
}

export interface EmployeeScheduleData {
  id: string;
  employeeNumber: string;
  name: string;
  unit: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  jobRole: string;
  currentTemplate: ScheduleTemplate | null;
  configurationStatus: 'CONFIGURED' | 'UNCONFIGURED' | 'NO_SCHEDULE';
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface PaginatedEmployeeSchedules {
  data: EmployeeScheduleData[];
  total: number;
  page: number;
  limit: number;
}

export interface DailyScheduleCoverage {
  date: string;
  status: 'WORKING' | 'DAY_OFF' | 'UNCONFIGURED' | 'NO_SCHEDULE';
  startTime: string | null;
  endTime: string | null;
  template: { id: string; name: string; version: number } | null;
  orgEvents: any[];
}

export interface EmployeeCoverage {
  employee: {
    id: string;
    name: string;
    employeeNumber: string;
    unit: { id: string; name: string } | null;
  };
  dailySchedules: DailyScheduleCoverage[];
  summary: {
    working: number;
    dayOff: number;
    unconfigured: number;
    noSchedule: number;
  };
}

export interface ScheduleCoverageResult {
  startDate: string;
  endDate: string;
  coverage: EmployeeCoverage[];
}

export interface ScheduleHistoryLog {
  id: string;
  targetEmployeeId: string;
  action: string;
  previousValue: any;
  newValue: any;
  remarks: string | null;
  createdAt: string;
  employee?: {
    firstName: string;
    lastName: string;
  };
  user?: {
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
      jobRole?: {
        title: string;
      };
    };
  };
}

export const scheduleApi = {
  getEmployeeSchedules: async (params?: { 
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
  }): Promise<PaginatedEmployeeSchedules> => {
    const res = await api.get('/schedules/employees', { params });
    return res.data;
  },

  getCoverage: async (params: {
    startDate: string;
    endDate: string;
    search?: string;
    unitId?: string;
    departmentId?: string;
    templateId?: string;
  }): Promise<ScheduleCoverageResult> => {
    const res = await api.get('/schedules/coverage', { params });
    return res.data.data;
  },
  
  getTemplates: async (includeCounts: boolean = false): Promise<ScheduleTemplate[]> => {
    const res = await api.get('/schedules/templates', { params: { includeCounts } });
    return res.data.data;
  },

  createTemplate: async (data: Partial<ScheduleTemplate>): Promise<ScheduleTemplate> => {
    const res = await api.post('/schedules/templates', data);
    return res.data.data;
  },

  updateTemplate: async (id: string, data: Partial<ScheduleTemplate>, effectiveDate: string): Promise<ScheduleTemplate> => {
    const res = await api.put(`/schedules/templates/${id}`, { data, effectiveDate });
    return res.data.data;
  },

  assignSchedule: async (employeeIds: string[], templateId: string, effectiveDate: string): Promise<void> => {
    await api.post('/schedules/assignments', { employeeIds, templateId, effectiveDate });
  },

  getHistory: async (employeeId?: string): Promise<ScheduleHistoryLog[]> => {
    const res = await api.get('/schedules/history' + (employeeId ? `?employeeId=${employeeId}` : ''));
    return res.data.data;
  }
};
