import { api } from './api';

export type RequirementCategory =
  | 'MEDICAL'
  | 'PSYCHOLOGICAL'
  | 'CERTIFICATION'
  | 'PROFESSIONAL_LICENSE'
  | 'TRAINING'
  | 'DOCUMENT'
  | 'OTHER';

export type RequirementLifecycle = 'ACTIVE' | 'INACTIVE';

export type RequirementScopeType = 'ALL' | 'UNIT' | 'DEPARTMENT' | 'JOB_ROLE' | 'EMPLOYEE';

export type RecordReviewStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';

export type EmployeeComplianceStatus = 'MISSING' | 'NEEDS_REVIEW' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface ComplianceRequirementScope {
  id: string;
  requirementId: string;
  scopeType: RequirementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
  targetUnit?: { id: string; name: string } | null;
  targetDepartment?: { id: string; name: string } | null;
  targetJobRole?: { id: string; title: string } | null;
  targetEmployee?: { id: string; firstName: string; lastName: string } | null;
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description?: string | null;
  category: RequirementCategory;
  tracksExpiry: boolean;
  reminderDays?: number | null;
  lifecycle: RequirementLifecycle;
  scopes?: ComplianceRequirementScope[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeComplianceRecord {
  id: string;
  employeeId: string;
  requirementId: string;
  recordTitle: string;
  referenceNumber?: string | null;
  completedAt: string;
  expiresAt?: string | null;
  notes?: string | null;
  reviewStatus: RecordReviewStatus;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  requirement?: {
    id: string;
    title: string;
    category: RequirementCategory;
    tracksExpiry: boolean;
    reminderDays?: number | null;
  };
  documents?: Array<{
    id: string;
    originalFilename: string;
    visibility: string;
    uploadedAt: string;
  }>;
}

export interface EmployeeComplianceSummaryItem {
  requirement: {
    id: string;
    title: string;
    description?: string | null;
    category: RequirementCategory;
    tracksExpiry: boolean;
    reminderDays?: number | null;
  };
  status: EmployeeComplianceStatus;
  latestRecordDate: string | null;
  expiresAt: string | null;
  recordId: string | null;
}

export interface OrgComplianceSummary {
  totalChecks: number;
  needsAttentionTotal?: number;
  summary: {
    missing: number;
    needsReview: number;
    expired: number;
    expiringSoon: number;
    valid: number;
  };
  requirementCount: number;
  employeeCount: number;
}

export interface NeedsAttentionItem {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    jobRole: string;
    unit: string;
    department?: string;
  };
  requirement: {
    id: string;
    title: string;
    category: RequirementCategory;
    tracksExpiry: boolean;
  };
  status: EmployeeComplianceStatus;
  latestRecordDate: string | null;
  expiresAt: string | null;
  recordId: string | null;
}

export interface EmployeeComplianceListItem {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    unitId?: string | null;
    departmentId?: string | null;
    jobRoleId?: string | null;
    unit?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    jobRole?: { id: string; title: string } | null;
  };
  valid: number;
  needsAttention: number;
  missing: number;
  needsReview: number;
  expired: number;
  expiring: number;
  totalApplicable: number;
}

export const ComplianceService = {
  // ── Requirements ──
  async listRequirements(params?: { lifecycle?: RequirementLifecycle; category?: RequirementCategory; search?: string }) {
    const res = await api.get('/compliance/requirements', { params });
    return res.data.data as ComplianceRequirement[];
  },

  async getRequirement(id: string) {
    const res = await api.get(`/compliance/requirements/${id}`);
    return res.data.data as ComplianceRequirement;
  },

  async createRequirement(data: {
    title: string;
    description?: string;
    category: RequirementCategory;
    tracksExpiry?: boolean;
    reminderDays?: number;
    scopes?: Array<{
      scopeType: RequirementScopeType;
      targetUnitId?: string;
      targetDepartmentId?: string;
      targetJobRoleId?: string;
      targetEmployeeId?: string;
    }>;
  }) {
    const res = await api.post('/compliance/requirements', data);
    return res.data.data as ComplianceRequirement;
  },

  async updateRequirement(id: string, data: Partial<ComplianceRequirement>) {
    const res = await api.patch(`/compliance/requirements/${id}`, data);
    return res.data.data as ComplianceRequirement;
  },

  async archiveRequirement(id: string) {
    const res = await api.delete(`/compliance/requirements/${id}`);
    return res.data;
  },

  // ── Scopes ──
  async addScope(requirementId: string, scope: {
    scopeType: RequirementScopeType;
    targetUnitId?: string;
    targetDepartmentId?: string;
    targetJobRoleId?: string;
    targetEmployeeId?: string;
  }) {
    const res = await api.post(`/compliance/requirements/${requirementId}/scopes`, scope);
    return res.data.data as ComplianceRequirementScope;
  },

  async deleteScope(scopeId: string) {
    const res = await api.delete(`/compliance/scopes/${scopeId}`);
    return res.data;
  },

  // ── Summaries & Actionable Items ──
  async getOrgSummary() {
    const res = await api.get('/compliance/summary');
    return res.data.data as OrgComplianceSummary;
  },

  async getNeedsAttention() {
    const res = await api.get('/compliance/needs-attention');
    return res.data.data as NeedsAttentionItem[];
  },

  async getEmployeesComplianceList() {
    const res = await api.get('/compliance/employees-list');
    return res.data.data as EmployeeComplianceListItem[];
  },

  async getEmployeeSummary(employeeId: string) {
    const res = await api.get(`/compliance/employees/${employeeId}/summary`);
    return res.data.data as EmployeeComplianceSummaryItem[];
  },

  // ── Employee Fulfillment Records ──
  async listEmployeeRecords(employeeId: string) {
    const res = await api.get(`/compliance/employees/${employeeId}/records`);
    return res.data.data as EmployeeComplianceRecord[];
  },

  async createEmployeeRecord(data: {
    employeeId: string;
    requirementId: string;
    recordTitle: string;
    referenceNumber?: string;
    completedAt: string;
    expiresAt?: string;
    notes?: string;
  }) {
    const res = await api.post('/compliance/records', data);
    return res.data.data as EmployeeComplianceRecord;
  },

  async reviewRecord(recordId: string, data: {
    reviewStatus: RecordReviewStatus;
    reviewReason?: string;
  }) {
    const res = await api.patch(`/compliance/records/${recordId}/review`, data);
    return res.data.data as EmployeeComplianceRecord;
  },

  async deleteRecord(recordId: string) {
    const res = await api.delete(`/compliance/records/${recordId}`);
    return res.data;
  },
};
