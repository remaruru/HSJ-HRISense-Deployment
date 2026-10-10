import { api } from './api';

export type TrainingActivityType =
  | 'TRAINING'
  | 'SEMINAR'
  | 'WORKSHOP'
  | 'ORIENTATION'
  | 'CONFERENCE'
  | 'OTHER';

export type TrainingActivityStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TrainingParticipationStatus =
  | 'ASSIGNED'
  | 'COMPLETED'
  | 'DID_NOT_ATTEND'
  | 'EXCUSED'
  | 'CANCELLED';

export interface TrainingParticipantStats {
  total: number;
  assigned: number;
  completed: number;
  didNotAttend: number;
  excused: number;
  cancelled?: number;
}

export interface TrainingParticipant {
  id: string;
  trainingActivityId: string;
  employeeId: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobRole?: { id: string; title: string } | null;
    department?: { id: string; name: string } | null;
    unit?: { id: string; name: string } | null;
  };
  participationStatus: TrainingParticipationStatus;
  assignedAt: string;
  completedAt?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  certificateOriginalFilename?: string | null;
  certificateStoredFilename?: string | null;
  certificateMimeType?: string | null;
  certificateSizeBytes?: number | null;
  complianceRecordId?: string | null;
  complianceRecord?: {
    id: string;
    recordTitle: string;
    expiresAt?: string | null;
    reviewStatus: string;
  } | null;
}

export interface TrainingActivityDocument {
  id: string;
  trainingActivityId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  notes?: string | null;
  uploadedById?: string | null;
  uploadedAt: string;
}

export interface TrainingActivity {
  id: string;
  title: string;
  type: TrainingActivityType;
  description?: string | null;
  provider: string;
  venue: string;
  startDate: string;
  startTime?: string | null;
  endDate: string;
  endTime?: string | null;
  hoursCredit?: number | null;
  maxParticipants?: number | null;
  status: TrainingActivityStatus;
  complianceRequirementId?: string | null;
  complianceRequirement?: {
    id: string;
    title: string;
    category: string;
  } | null;
  materialsUrl?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: TrainingParticipant[];
  documents: TrainingActivityDocument[];
  participantStats: TrainingParticipantStats;
}

export interface CreateTrainingActivityDto {
  title: string;
  type?: TrainingActivityType;
  description?: string;
  provider: string;
  venue: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  hoursCredit?: number;
  maxParticipants?: number;
  status?: TrainingActivityStatus;
  complianceRequirementId?: string | null;
  materialsUrl?: string;
  participantEmployeeIds?: string[];
}

export interface UpdateTrainingActivityDto {
  title?: string;
  type?: TrainingActivityType;
  description?: string;
  provider?: string;
  venue?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  hoursCredit?: number;
  maxParticipants?: number;
  status?: TrainingActivityStatus;
  complianceRequirementId?: string | null;
  materialsUrl?: string;
}

export interface AddParticipantsDto {
  employeeIds: string[];
}

export interface UpdateParticipantStatusDto {
  participationStatus: TrainingParticipationStatus;
  completedAt?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  complianceRecordId?: string | null;
}

export interface BulkUpdateParticipantStatusDto {
  employeeIds: string[];
  status: TrainingParticipationStatus;
  completedAt?: string | null;
  validUntil?: string | null;
  notes?: string | null;
}

export interface ListTrainingFilters {
  type?: TrainingActivityType;
  status?: TrainingActivityStatus;
  search?: string;
}

export interface EmployeeTrainingHistoryItem {
  participantId: string;
  activityId: string;
  title: string;
  type: TrainingActivityType;
  provider: string;
  venue: string;
  startDate: string;
  endDate: string;
  hoursCredit?: number | null;
  activityStatus: TrainingActivityStatus;
  participationStatus: TrainingParticipationStatus;
  assignedAt: string;
  completedAt?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  certificateOriginalFilename?: string | null;
  certificateSizeBytes?: number | null;
  complianceRequirement?: {
    id: string;
    title: string;
    category: string;
  } | null;
  complianceRecord?: {
    id: string;
    recordTitle: string;
    expiresAt?: string | null;
    reviewStatus: string;
  } | null;
}

// ── Friendly Formatters & Helpers ─────────────────────────────────────────────

export const TRAINING_TYPE_LABELS: Record<TrainingActivityType, string> = {
  TRAINING: 'Training',
  SEMINAR: 'Seminar',
  WORKSHOP: 'Workshop',
  ORIENTATION: 'Orientation',
  CONFERENCE: 'Conference',
  OTHER: 'Other',
};

export const TRAINING_STATUS_META: Record<
  TrainingActivityStatus,
  { label: string; badgeClass: string }
> = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  SCHEDULED: {
    label: 'Scheduled',
    // Waiting for its date — pending, not a hand-picked blue.
    badgeClass: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
  },
  COMPLETED: {
    label: 'Completed',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
  },
  CANCELLED: {
    label: 'Cancelled',
    // Cancelled is not a failure; it is simply no longer happening.
    badgeClass: 'bg-status-neutral-surface text-status-neutral-foreground border-status-neutral-border',
  },
};

export const PARTICIPATION_STATUS_META: Record<
  TrainingParticipationStatus,
  { label: string; badgeClass: string }
> = {
  ASSIGNED: {
    label: 'Assigned',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  COMPLETED: {
    label: 'Completed',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
  },
  DID_NOT_ATTEND: {
    label: 'Did Not Attend',
    badgeClass: 'bg-status-danger-surface text-status-danger-foreground border-status-danger-border',
  },
  EXCUSED: {
    label: 'Excused',
    badgeClass: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
  },
};

export const TrainingService = {
  async listActivities(filters?: ListTrainingFilters): Promise<TrainingActivity[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const res = await api.get<{ success: boolean; data: TrainingActivity[] }>(
      `/training?${params.toString()}`
    );
    return res.data.data;
  },

  async getActivity(id: string): Promise<TrainingActivity> {
    const res = await api.get<{ success: boolean; data: TrainingActivity }>(
      `/training/${id}`
    );
    return res.data.data;
  },

  async createActivity(data: CreateTrainingActivityDto): Promise<TrainingActivity> {
    const res = await api.post<{ success: boolean; data: TrainingActivity; message: string }>(
      '/training',
      data
    );
    return res.data.data;
  },

  async updateActivity(id: string, data: UpdateTrainingActivityDto): Promise<TrainingActivity> {
    const res = await api.put<{ success: boolean; data: TrainingActivity; message: string }>(
      `/training/${id}`,
      data
    );
    return res.data.data;
  },

  async cancelActivity(id: string): Promise<TrainingActivity> {
    const res = await api.post<{ success: boolean; data: TrainingActivity; message: string }>(
      `/training/${id}/cancel`
    );
    return res.data.data;
  },

  async addParticipants(id: string, dto: AddParticipantsDto): Promise<TrainingActivity> {
    const res = await api.post<{ success: boolean; data: TrainingActivity; message: string }>(
      `/training/${id}/participants`,
      dto
    );
    return res.data.data;
  },

  async updateParticipantStatus(
    activityId: string,
    employeeId: string,
    dto: UpdateParticipantStatusDto
  ): Promise<TrainingParticipant> {
    const res = await api.put<{ success: boolean; data: TrainingParticipant; message: string }>(
      `/training/${activityId}/participants/${employeeId}`,
      dto
    );
    return res.data.data;
  },

  async bulkUpdateParticipantStatus(
    activityId: string,
    dto: BulkUpdateParticipantStatusDto
  ): Promise<TrainingActivity> {
    const res = await api.post<{ success: boolean; data: TrainingActivity; message: string }>(
      `/training/${activityId}/participants/bulk-status`,
      dto
    );
    return res.data.data;
  },

  async listEmployeeTrainingHistory(employeeId: string): Promise<EmployeeTrainingHistoryItem[]> {
    const res = await api.get<{ success: boolean; data: EmployeeTrainingHistoryItem[] }>(
      `/training/employees/${employeeId}/history`
    );
    return res.data.data;
  },

  async uploadCertificate(
    activityId: string,
    employeeId: string,
    file: File
  ): Promise<TrainingParticipant> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; data: TrainingParticipant; message: string }>(
      `/training/${activityId}/participants/${employeeId}/certificate`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data.data;
  },

  async downloadCertificate(
    activityId: string,
    employeeId: string,
    filename = 'certificate.pdf'
  ): Promise<void> {
    const res = await api.get(`/training/${activityId}/participants/${employeeId}/certificate`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async uploadActivityDocument(
    activityId: string,
    file: File,
    notes?: string
  ): Promise<TrainingActivityDocument> {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('notes', notes);
    const res = await api.post<{ success: boolean; data: TrainingActivityDocument; message: string }>(
      `/training/${activityId}/documents`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data.data;
  },

  async downloadActivityDocument(
    activityId: string,
    documentId: string,
    filename = 'document.pdf'
  ): Promise<void> {
    const res = await api.get(`/training/${activityId}/documents/${documentId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
