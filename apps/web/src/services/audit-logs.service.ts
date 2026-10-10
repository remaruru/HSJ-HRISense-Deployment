import { api } from '@/services/api';

/**
 * Audit Logs (HR only). The API classifies every event into a tab, module and
 * action type and returns it as a readable sentence — the page never sees raw
 * audit payloads.
 */

export type AuditTabId =
  | 'ALL'
  | 'EMPLOYEES'
  | 'ATTENDANCE'
  | 'LEAVE'
  | 'EVALUATIONS'
  | 'COMPLIANCE'
  | 'RECRUITMENT'
  | 'COMMUNICATION'
  | 'AWARDS'
  | 'SYSTEM'
  | 'SECURITY';

export interface AuditOptionScope {
  modules: Array<{ id: string; label: string; tab: AuditTabId }>;
  actionTypes: Array<{ id: string; label: string }>;
  hasFailures: boolean;
}

export interface AuditTabOption extends AuditOptionScope {
  id: AuditTabId;
  label: string;
}

export interface AuditActorOption {
  id: string;
  name: string;
  employeeNumber: string | null;
}

export interface AuditOptions {
  tabs: AuditTabOption[];
  actors: AuditActorOption[];
}

export interface AuditDetailItem {
  label: string;
  value: string;
}

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
  /** Confidential or an ID number: only the fact of the change is shown. */
  hidden: boolean;
}

export interface AuditEvent {
  id: string;
  source: 'audit' | 'schedule';
  createdAt: string;
  action: string;
  actionLabel: string;
  actionType: string;
  actionTypeLabel: string;
  module: string;
  moduleLabel: string;
  tab: AuditTabId;
  tabLabel: string;
  outcome: 'SUCCESS' | 'FAILURE';
  confidential: boolean;
  summary: string;
  actor: { id: string; name: string; email: string; employeeNumber: string | null } | null;
  subject: { kind: 'EMPLOYEE' | 'APPLICANT'; id: string; name: string; reference: string | null } | null;
  record: { type: string; label: string | null; reference: string | null };
  changes: AuditChange[];
  changedFields: string[];
  recorded: { title: string; items: AuditDetailItem[] } | null;
  details: AuditDetailItem[];
  ipAddress: string | null;
}

export interface AuditQuery {
  page: number;
  limit: number;
  tab: AuditTabId;
  module?: string;
  actionType?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  search?: string;
  target?: string;
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AuditPage {
  data: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  tabCounts: Partial<Record<AuditTabId, number>>;
}

export const auditLogsService = {
  async options(): Promise<AuditOptions> {
    const res = await api.get('/audit/options');
    return res.data?.data ?? { tabs: [], actors: [] };
  },

  async list(query: AuditQuery): Promise<AuditPage> {
    // Empty filters are left out of the query string.
    const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    const res = await api.get('/audit', { params });
    return {
      data: res.data?.data ?? [],
      total: res.data?.total ?? 0,
      page: res.data?.page ?? query.page,
      limit: res.data?.limit ?? query.limit,
      tabCounts: res.data?.tabCounts ?? {},
    };
  },
};
