import { api } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENT TYPES (Frontend)
// ─────────────────────────────────────────────────────────────────────────────

export type AnnouncementPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type AnnouncementState = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AnnouncementDerivedStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
export type AnnouncementScopeType = 'ALL' | 'UNIT' | 'DEPARTMENT' | 'JOB_ROLE' | 'EMPLOYEE';

export interface ScopeInput {
  scopeType: AnnouncementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
}

export interface AnnouncementAudienceScope {
  id?: string;
  announcementId?: string;
  scopeType: AnnouncementScopeType;
  targetUnitId?: string | null;
  targetDepartmentId?: string | null;
  targetJobRoleId?: string | null;
  targetEmployeeId?: string | null;
  targetUnit?: { id: string; name: string } | null;
  targetDepartment?: { id: string; name: string } | null;
  targetJobRole?: { id: string; title: string } | null;
  targetEmployee?: { id: string; firstName: string; lastName: string } | null;
}

export interface AnnouncementAttachment {
  id: string;
  announcementId?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface AnnouncementRecipientItem {
  employeeId: string;
  employeeNumber: string;
  name: string;
  unit?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  jobRole?: { id: string; title: string } | null;
  isRead: boolean;
  readAt: string | null;
}

export interface AnnouncementRecipientStats {
  totalRecipients: number;
  readCount: number;
  unreadCount: number;
  /** Read and unread shares of the recipients — computed by the API, they total exactly 100. */
  readPercent?: number | null;
  unreadPercent?: number | null;
}

export interface AnnouncementStats {
  drafts: number;
  scheduled: number;
  published: number;
  expired: number;
  archived: number;
}

export interface AudiencePreviewEmployee {
  employeeId: string;
  employeeNumber: string;
  name: string;
  unit?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  jobRole?: { id: string; title: string } | null;
}

export interface AudiencePreviewResponse {
  totalRecipients: number;
  previewEmployees: AudiencePreviewEmployee[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  content?: string;
  priority: AnnouncementPriority;
  state: AnnouncementState;
  isPinned: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  derivedStatus: AnnouncementDerivedStatus;
  audienceScopes?: AnnouncementAudienceScope[];
  attachments?: AnnouncementAttachment[];
  recipientStats?: AnnouncementRecipientStats;
  _count?: {
    recipients: number;
    attachments: number;
  };
  createdBy?: {
    id: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

export interface CreateAnnouncementDto {
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  expiresAt?: string | null;
  scopes?: ScopeInput[];
}

export interface UpdateAnnouncementDto {
  title?: string;
  body?: string;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  expiresAt?: string | null;
  publishAt?: string | null;
  scopes?: ScopeInput[];
}

export interface RecipientAnnouncement {
  id: string;
  title: string;
  body: string | null;
  content?: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  derivedStatus: AnnouncementDerivedStatus;
  readAt: string | null;
  isRead: boolean;
  _count?: {
    attachments: number;
  };
  attachments?: AnnouncementAttachment[];
}

export interface DashboardAnnouncementsResponse {
  announcements: RecipientAnnouncement[];
  unreadCurrentCount: number;
}

export interface MarkReadResponse {
  announcementId: string;
  readAt: string;
  alreadyRead: boolean;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENT SERVICE (Frontend API Wrapper)
// ─────────────────────────────────────────────────────────────────────────────

export const AnnouncementService = {
  /**
   * List announcements for recipient feed (Current, Past, or Unread).
   */
  async listForRecipient(options?: {
    filter?: 'current' | 'past';
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: RecipientAnnouncement[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams();
    if (options?.filter) params.append('filter', options.filter);
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));

    const res = await api.get<{
      success: boolean;
      data: RecipientAnnouncement[];
      pagination: PaginationMetadata;
    }>(`/announcements?${params.toString()}`);

    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  /**
   * Get announcement detail for recipient viewing.
   */
  async getRecipientAnnouncement(id: string): Promise<RecipientAnnouncement> {
    const res = await api.get<{ success: boolean; data: RecipientAnnouncement }>(`/announcements/${id}`);
    return res.data.data;
  },

  /**
   * Mark an announcement as read for the current recipient employee.
   */
  async markRead(id: string): Promise<MarkReadResponse> {
    const res = await api.post<{ success: boolean; data: MarkReadResponse }>(`/announcements/${id}/read`);
    return res.data.data;
  },

  /**
   * Get unread count of current announcements for sidebar/badges.
   */
  async getUnreadCount(): Promise<number> {
    const res = await api.get<{ success: boolean; data: UnreadCountResponse }>('/announcements/unread-count');
    return res.data.data.unreadCount;
  },

  /**
   * Get newest current announcements and unread count for dashboard widget.
   */
  async getDashboardAnnouncements(): Promise<DashboardAnnouncementsResponse> {
    const res = await api.get<{ success: boolean; data: DashboardAnnouncementsResponse }>(
      '/announcements/dashboard'
    );
    return res.data.data;
  },
  /**
   * Preview audience resolution and recipient count without saving.
   */
  async previewAudience(scopes: ScopeInput[]): Promise<AudiencePreviewResponse> {
    const res = await api.post<{ success: boolean; data: AudiencePreviewResponse }>(
      '/announcements/audience-preview',
      { scopes }
    );
    return res.data.data;
  },

  /**
   * List announcements for HR Management view (paginated, with filters).
   */
  async listForHR(filters?: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Announcement[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
    if (filters?.search?.trim()) params.append('search', filters.search.trim());
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const res = await api.get<{
      success: boolean;
      data: Announcement[];
      pagination: PaginationMetadata;
    }>(`/announcements/hr?${params.toString()}`);

    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  /**
   * Get HR aggregate summary statistics for summary cards.
   */
  async getStats(): Promise<AnnouncementStats> {
    const res = await api.get<{ success: boolean; data: AnnouncementStats }>('/announcements/stats');
    return res.data.data;
  },

  /**
   * Get announcement detail by ID (FULL HR management access).
   */
  async getAnnouncement(id: string): Promise<Announcement> {
    const res = await api.get<{ success: boolean; data: Announcement }>(`/announcements/${id}`);
    return res.data.data;
  },

  /**
   * Create a new DRAFT announcement.
   */
  async createDraft(dto: CreateAnnouncementDto): Promise<Announcement> {
    const res = await api.post<{ success: boolean; data: Announcement }>('/announcements', dto);
    return res.data.data;
  },

  /**
   * Update an existing announcement (DRAFT, SCHEDULED, or PUBLISHED).
   */
  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const res = await api.put<{ success: boolean; data: Announcement }>(`/announcements/${id}`, dto);
    return res.data.data;
  },

  /**
   * Publish an announcement immediately (atomic publication).
   */
  async activateAnnouncement(id: string): Promise<Announcement> {
    const res = await api.post<{ success: boolean; data: Announcement }>(`/announcements/${id}/activate`);
    return res.data.data;
  },

  /**
   * Schedule an announcement for future publication.
   */
  async scheduleAnnouncement(id: string, publishAt: string): Promise<Announcement> {
    const res = await api.post<{ success: boolean; data: Announcement }>(`/announcements/${id}/schedule`, {
      publishAt,
    });
    return res.data.data;
  },

  /**
   * Archive an announcement (preserves historical record).
   */
  async archiveAnnouncement(id: string): Promise<Announcement> {
    const res = await api.post<{ success: boolean; data: Announcement }>(`/announcements/${id}/archive`);
    return res.data.data;
  },

  /**
   * Permanently delete an announcement that is finished with — a DRAFT that was
   * never sent, or an ARCHIVED one already pulled from every feed. A published
   * announcement has to be archived first.
   */
  async deleteAnnouncement(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },

  /**
   * Get recipient read statistics for an announcement.
   */
  async getRecipientStats(id: string): Promise<AnnouncementRecipientStats> {
    const res = await api.get<{ success: boolean; data: AnnouncementRecipientStats }>(
      `/announcements/${id}/recipients/stats`
    );
    return res.data.data;
  },

  /**
   * List paginated recipients for an announcement (HR management only).
   */
  async listRecipients(
    id: string,
    filters?: {
      search?: string;
      readFilter?: 'all' | 'read' | 'unread';
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: AnnouncementRecipientItem[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams();
    if (filters?.search?.trim()) params.append('search', filters.search.trim());
    if (filters?.readFilter && filters.readFilter !== 'all') params.append('readFilter', filters.readFilter);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const res = await api.get<{
      success: boolean;
      data: AnnouncementRecipientItem[];
      pagination: PaginationMetadata;
    }>(`/announcements/${id}/recipients?${params.toString()}`);

    return {
      data: res.data.data,
      pagination: res.data.pagination,
    };
  },

  /**
   * Upload an attachment to a DRAFT or SCHEDULED announcement.
   */
  async uploadAttachment(announcementId: string, file: File): Promise<AnnouncementAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post<{
      success: boolean;
      data: AnnouncementAttachment;
      message: string;
    }>(`/announcements/${announcementId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  /**
   * Securely download an announcement attachment using authenticated blob stream.
   */
  async downloadAttachment(
    announcementId: string,
    attachmentId: string,
    filename = 'attachment'
  ): Promise<void> {
    const res = await api.get(`/announcements/${announcementId}/attachments/${attachmentId}`, {
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

  /**
   * Remove an attachment from a DRAFT or SCHEDULED announcement.
   */
  async deleteAttachment(announcementId: string, attachmentId: string): Promise<void> {
    await api.delete(`/announcements/${announcementId}/attachments/${attachmentId}`);
  },

  /**
   * List safe attachment metadata for an announcement.
   */
  async listAttachments(announcementId: string): Promise<AnnouncementAttachment[]> {
    const res = await api.get<{ success: boolean; data: AnnouncementAttachment[] }>(
      `/announcements/${announcementId}/attachments`
    );
    return res.data.data;
  },
};
