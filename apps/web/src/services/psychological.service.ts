import { api } from './api';
import { downloadProtectedFile } from '@/lib/downloadProtectedFile';

export interface PsychologicalRecordDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes?: number;
  visibility: 'EMPLOYEE_VISIBLE' | 'HR_ONLY';
  notes?: string | null;
  uploadedAt: string;
}

export interface PsychologicalRecordEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  unit?: { id: string; name: string; code?: string } | null;
  department?: { id: string; name: string; code?: string } | null;
  jobRole?: { id: string; title: string; code?: string } | null;
}

export interface PsychologicalRecordHistoryItem {
  id: string;
  assessmentType: string;
  assessmentDate: string;
  expiresAt?: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
  requirement?: { id: string; title: string } | null;
}

export interface PsychologicalRecord {
  id: string;
  employeeId: string;
  employee?: PsychologicalRecordEmployee | null;
  requirementId?: string | null;
  assessmentType: string;
  assessmentDate: string;
  conductedBy?: string | null;
  employeeVisibleSummary?: string | null;
  hrConfidentialNotes?: string | null;
  expiresAt?: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  complianceStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NEEDS_REVIEW';
  documentCount?: number;
  documents?: PsychologicalRecordDocument[];
  requirement?: {
    id: string;
    title: string;
    category: string;
  } | null;
  history?: PsychologicalRecordHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PsychologicalSummaryMetrics {
  totalRecords: number;
  needsReview: number;
  expiringSoon: number;
  expired: number;
}

export interface PsychologicalRecordListParams {
  search?: string;
  unitId?: string;
  departmentId?: string;
  jobRoleId?: string;
  requirementId?: string;
  assessmentType?: string;
  reviewStatus?: string;
  complianceStatus?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPsychologicalRecords {
  records: PsychologicalRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const PsychologicalService = {
  async listAllRecords(params?: PsychologicalRecordListParams) {
    const res = await api.get('/psychological/records', { params });
    return res.data.data as PaginatedPsychologicalRecords;
  },

  async getSummary() {
    const res = await api.get('/psychological/summary');
    return res.data.data as PsychologicalSummaryMetrics;
  },

  async listRecords(employeeId: string) {
    const res = await api.get(`/psychological/employees/${employeeId}/records`);
    return res.data.data as PsychologicalRecord[];
  },

  async getRecord(recordId: string) {
    const res = await api.get(`/psychological/records/${recordId}`);
    return res.data.data as PsychologicalRecord;
  },

  async createRecord(data: {
    employeeId: string;
    requirementId?: string;
    assessmentType: string;
    assessmentDate: string;
    conductedBy?: string;
    employeeVisibleSummary?: string;
    hrConfidentialNotes?: string;
    expiresAt?: string;
  }) {
    const res = await api.post('/psychological/records', data);
    return res.data.data as PsychologicalRecord;
  },

  async updateRecord(recordId: string, data: Partial<PsychologicalRecord>) {
    const res = await api.patch(`/psychological/records/${recordId}`, data);
    return res.data.data as PsychologicalRecord;
  },

  async reviewRecord(recordId: string, data: {
    reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
    reviewReason?: string;
  }) {
    const res = await api.patch(`/psychological/records/${recordId}/review`, data);
    return res.data.data as PsychologicalRecord;
  },

  async deleteRecord(recordId: string) {
    const res = await api.delete(`/psychological/records/${recordId}`);
    return res.data;
  },

  async uploadDocument(recordId: string, file: File, data: {
    visibility: 'EMPLOYEE_VISIBLE' | 'HR_ONLY';
    notes?: string;
  }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('visibility', data.visibility);
    if (data.notes) formData.append('notes', data.notes);

    const res = await api.post(`/psychological/records/${recordId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as PsychologicalRecordDocument;
  },

  async deleteDocument(documentId: string) {
    const res = await api.delete(`/psychological/documents/${documentId}`);
    return res.data;
  },

  /**
   * Downloads a psychological document through the authenticated stream route.
   * Replaces `getDocumentDownloadUrl`, whose bare URL could not carry the bearer
   * token when used in an `<a href>`.
   */
  async downloadDocument(documentId: string, filename: string) {
    await downloadProtectedFile(`/psychological/documents/${documentId}/stream`, filename);
  },
};
