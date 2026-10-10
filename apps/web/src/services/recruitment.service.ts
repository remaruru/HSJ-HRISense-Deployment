import { api } from './api';

export type JobOpeningStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FILLED' | 'ARCHIVED';
export type EmploymentStatus = 'REGULAR' | 'PROBATIONARY' | 'CONTRACTUAL' | 'CASUAL' | 'PART_TIME';

export interface Unit {
  id: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface JobRole {
  id: string;
  title: string;
  code: string;
}

export interface JobOpening {
  id: string;
  referenceNumber: string;
  slug: string;
  title: string;
  unitId: string;
  departmentId?: string;
  jobRoleId: string;
  employmentType: EmploymentStatus;
  vacancies?: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredDocuments?: string;
  openingDate: string;
  closingDate: string;
  status: JobOpeningStatus;
  createdById: string;
  updatedById: string;
  publishedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;

  unit?: Unit;
  department?: Department;
  jobRole?: JobRole;
  _count?: {
    applications: number;
  };
}

export interface RecruitmentOverviewStats {
  activeOpenings: number;
  totalApplications: number;
  underReview: number;
  forInterview: number;
  hired: number;
  rejectedOrWithdrawn: number;
}

export interface CreateJobOpeningPayload {
  title: string;
  unitId: string;
  departmentId?: string;
  jobRoleId: string;
  employmentType: EmploymentStatus;
  vacancies?: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredDocuments?: string;
  openingDate: string;
  closingDate: string;
}

export interface UpdateJobOpeningPayload extends Partial<CreateJobOpeningPayload> {
  status?: JobOpeningStatus;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export class RecruitmentService {
  static async getOverviewStats(): Promise<RecruitmentOverviewStats> {
    const response = await api.get('/recruitment/overview');
    return response.data.data;
  }

  static async getJobOpenings(params?: {
    status?: JobOpeningStatus | '';
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<JobOpening>> {
    const response = await api.get('/recruitment/openings', { params });
    return response.data.data;
  }

  static async getJobOpeningById(id: string): Promise<JobOpening> {
    const response = await api.get(`/recruitment/openings/${id}`);
    return response.data.data;
  }

  static async createJobOpening(data: CreateJobOpeningPayload): Promise<JobOpening> {
    const response = await api.post('/recruitment/openings', data);
    return response.data.data;
  }

  static async updateJobOpening(id: string, data: UpdateJobOpeningPayload): Promise<JobOpening> {
    const response = await api.patch(`/recruitment/openings/${id}`, data);
    return response.data.data;
  }

  static async changeJobOpeningStatus(id: string, status: JobOpeningStatus): Promise<JobOpening> {
    const response = await api.patch(`/recruitment/openings/${id}/status`, { status });
    return response.data.data;
  }

  static async getApplications(params?: {
    openingId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const response = await api.get('/recruitment/applications', { params });
    return response.data.data;
  }

  static async getApplicationById(id: string): Promise<any> {
    const response = await api.get(`/recruitment/applications/${id}`);
    return response.data.data;
  }

  static async changeApplicationStatus(id: string, status: string, reason?: string): Promise<any> {
    const response = await api.patch(`/recruitment/applications/${id}/status`, { status, reason });
    return response.data.data;
  }

  static async addApplicantNote(applicationId: string, content: string): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/notes`, { note: content });
    return response.data.data;
  }

  static async downloadApplicantDocument(applicationId: string, documentId: string): Promise<Blob> {
    const response = await api.get(`/recruitment/applications/${applicationId}/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  static async previewApplicantDocument(applicationId: string, documentId: string): Promise<Blob> {
    const response = await api.get(`/recruitment/applications/${applicationId}/documents/${documentId}/preview`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // INTERVIEWS
  static async scheduleInterview(applicationId: string, data: any): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/interviews`, data);
    return response.data.data;
  }

  static async updateInterviewStatus(applicationId: string, interviewId: string, data: any): Promise<any> {
    const response = await api.patch(`/recruitment/applications/${applicationId}/interviews/${interviewId}`, data);
    return response.data.data;
  }

  static async rescheduleInterview(applicationId: string, interviewId: string, data: any): Promise<any> {
    const response = await api.patch(`/recruitment/applications/${applicationId}/interviews/${interviewId}/reschedule`, data);
    return response.data.data;
  }

  // COMMUNICATIONS
  static async listCommunications(applicationId: string): Promise<{ items: any[], devEmailMode: boolean }> {
    const response = await api.get(`/recruitment/applications/${applicationId}/communications`);
    return {
      items: response.data.data,
      devEmailMode: response.data.meta?.devEmailMode || false
    };
  }

  static async previewEmail(applicationId: string, type: string, data: any): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/communications/preview`, { type, data });
    return response.data.data;
  }

  static async sendEmail(applicationId: string, type: string, data: any): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/communications`, { type, data });
    return response.data.data;
  }

  static async retryCommunication(applicationId: string, communicationId: string): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/communications/${communicationId}/retry`);
    return response.data.data;
  }

  // CONVERSION
  static async convertToOnboarding(applicationId: string): Promise<any> {
    const response = await api.post(`/recruitment/applications/${applicationId}/convert`);
    return response.data.data;
  }
}
