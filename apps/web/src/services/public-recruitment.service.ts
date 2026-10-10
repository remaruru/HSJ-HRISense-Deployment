import { publicApi } from './api';

export interface PublicJobOpening {
  id: string;
  slug: string;
  title: string;
  employmentType: string;
  vacancies?: number;
  description: string;
  responsibilities: string;
  qualifications: string;
  requiredDocuments?: string;
  openingDate: string;
  closingDate: string;
  unit: { name: string };
  department?: { name: string } | null;
}

export interface PublicPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SubmitApplicationPayload {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email: string;
  mobileNumber: string;
  presentAddress?: string;
  /** Picked from the list, or typed by the applicant under "Others". */
  religion?: string;
  /** MALE | FEMALE | PREFER_NOT_TO_SAY. Optional. */
  gender?: string;
  source?: string;
  message?: string;
  privacyConsent: boolean;
}

export interface ApplicationSuccessResult {
  referenceNumber: string;
  /**
   * Opaque token for the login-free status page
   * (`/careers/application-status/:statusToken`). Applicants never get an account.
   */
  statusToken?: string;
}

/** A vacancy accepting applications now (OPEN and within its dates). */
export interface PublicOpenPosition {
  slug: string;
  title: string;
  /** The job role (position) the opening is for. */
  position: string;
  employmentType: string;
  vacancies?: number | null;
  openingDate: string;
  closingDate: string;
  unit: string;
  department: string | null;
}

export interface PublicOpenPositions {
  openings: PublicOpenPosition[];
  counts: { open: number };
}

export class PublicRecruitmentService {
  /** Only the openings accepting applications now — never every job role. */
  static async getOpenPositions(): Promise<PublicOpenPositions> {
    const response = await publicApi.get('/public/recruitment/positions');
    return response.data.data;
  }

  static async getOpenings(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PublicPaginatedResult<PublicJobOpening>> {
    const response = await publicApi.get('/public/recruitment/openings', { params });
    return response.data.data;
  }

  static async getOpeningBySlug(slug: string): Promise<PublicJobOpening> {
    const response = await publicApi.get(`/public/recruitment/openings/${slug}`);
    return response.data.data;
  }

  static async submitApplication(
    openingId: string,
    payload: SubmitApplicationPayload,
    resume: File,
    coverLetter?: File | null,
    /** The "I'm not a robot" token, when the checkbox is switched on. Sent as a header so the server checks it before reading the upload. */
    captchaToken?: string | null
  ): Promise<ApplicationSuccessResult> {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });
    
    formData.append('resume', resume);
    if (coverLetter) {
      formData.append('coverLetter', coverLetter);
    }

    const response = await publicApi.post(`/public/recruitment/openings/${openingId}/apply`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(captchaToken ? { 'X-Captcha-Token': captchaToken } : {}),
      },
    });
    return response.data.data;
  }

}
