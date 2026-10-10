import { api } from './api';
import { downloadProtectedFile } from '@/lib/downloadProtectedFile';

export interface MedicalRecordDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes?: number;
  notes?: string | null;
  uploadedAt: string;
}

export interface MedicalRecordEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  unit?: { id: string; name: string; code?: string } | null;
  department?: { id: string; name: string; code?: string } | null;
  jobRole?: { id: string; title: string; code?: string } | null;
}

export interface MedicalRecordHistoryItem {
  id: string;
  examType: string;
  examDate: string;
  expiresAt?: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
  requirement?: { id: string; title: string } | null;
}

export interface MedicalRecord {
  id: string;
  employeeId: string;
  employee?: MedicalRecordEmployee | null;
  requirementId?: string | null;
  examType: string;
  examDate: string;
  examinedBy?: string | null;
  hrNotes?: string | null;
  expiresAt?: string | null;
  reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  complianceStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NEEDS_REVIEW';
  documentCount?: number;
  documents?: MedicalRecordDocument[];
  requirement?: {
    id: string;
    title: string;
    category: string;
  } | null;
  history?: MedicalRecordHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MedicalSummaryMetrics {
  totalRecords: number;
  needsReview: number;
  expiringSoon: number;
  expired: number;
}

export interface MedicalRecordListParams {
  search?: string;
  unitId?: string;
  departmentId?: string;
  jobRoleId?: string;
  requirementId?: string;
  examType?: string;
  reviewStatus?: string;
  complianceStatus?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedMedicalRecords {
  records: MedicalRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const MedicalService = {
  async listAllRecords(params?: MedicalRecordListParams) {
    const res = await api.get('/medical/records', { params });
    return res.data.data as PaginatedMedicalRecords;
  },

  async getSummary() {
    const res = await api.get('/medical/summary');
    return res.data.data as MedicalSummaryMetrics;
  },

  async listRecords(employeeId: string) {
    const res = await api.get(`/medical/employees/${employeeId}/records`);
    return res.data.data as MedicalRecord[];
  },

  async getRecord(recordId: string) {
    const res = await api.get(`/medical/records/${recordId}`);
    return res.data.data as MedicalRecord;
  },

  async createRecord(data: {
    employeeId: string;
    requirementId?: string;
    examType: string;
    examDate: string;
    examinedBy?: string;
    hrNotes?: string;
    expiresAt?: string;
  }) {
    const res = await api.post('/medical/records', data);
    return res.data.data as MedicalRecord;
  },

  async updateRecord(recordId: string, data: Partial<MedicalRecord>) {
    const res = await api.patch(`/medical/records/${recordId}`, data);
    return res.data.data as MedicalRecord;
  },

  async reviewRecord(recordId: string, data: {
    reviewStatus: 'PENDING_REVIEW' | 'ACCEPTED' | 'NEEDS_CORRECTION';
    reviewReason?: string;
  }) {
    const res = await api.patch(`/medical/records/${recordId}/review`, data);
    return res.data.data as MedicalRecord;
  },

  async deleteRecord(recordId: string) {
    const res = await api.delete(`/medical/records/${recordId}`);
    return res.data;
  },

  async uploadDocument(recordId: string, file: File, notes?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('notes', notes);

    const res = await api.post(`/medical/records/${recordId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as MedicalRecordDocument;
  },

  async deleteDocument(documentId: string) {
    const res = await api.delete(`/medical/documents/${documentId}`);
    return res.data;
  },

  /**
   * Downloads a medical document through the authenticated stream route.
   *
   * This replaced `getDocumentDownloadUrl`, which returned a bare URL used in an
   * `<a href>`. An anchor cannot send the bearer token, so those downloads always
   * failed with 401.
   */
  async downloadDocument(documentId: string, filename: string) {
    await downloadProtectedFile(`/medical/documents/${documentId}/stream`, filename);
  },
};
