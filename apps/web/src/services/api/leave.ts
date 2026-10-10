import { api } from '../api';

export interface LeaveRequestPayload {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  supportingDocUrl?: string;
  /** Hospicio form: where the employee can be reached during the leave. */
  addressDuringLeave?: string;
  /** Hospicio form: contact number during the leave. */
  contactNumber?: string;
}

/** Other dates (or fewer days) for a request, with the reason. */
export interface LeaveChange {
  startDate: string;
  endDate: string;
  reason: string;
}

export interface BatchLeavePayload extends LeaveRequestPayload {
  targetMode: 'self' | 'employees' | 'all';
  targetEmployeeIds?: string[];
}

export interface BatchLeaveResponse {
  success: boolean;
  created: any[];
  failed: { employeeId: string; reason: string }[];
  summary: { requested: number; created: number; failed: number };
}

export const leaveApi = {
  create: async (data: LeaveRequestPayload) => {
    const res = await api.post('/leave', data);
    return res.data;
  },

  createBatch: async (data: BatchLeavePayload): Promise<{ status: number, data: BatchLeaveResponse }> => {
    // Need to return full axios response to handle 201 vs 207 vs 400
    // We catch and throw in interceptors, but we can instruct axios to not throw on 400 if needed,
    // or just let the caller catch it.
    const res = await api.post('/leave/batch', data, {
      validateStatus: (status: number) => status >= 200 && status < 300 || status === 400
    });
    return { status: res.status, data: res.data };
  },

  getBalances: async (employeeId?: string) => {
    const res = await api.get('/leave/balances', { params: { employeeId } });
    return res.data;
  },

  /** One request with its employee context, leave record and history. */
  getById: async (id: string) => {
    const res = await api.get(`/leave/${id}`);
    return res.data;
  },

  /**
   * Head / supervisor recommendation — moves a request to HR for the final
   * decision, optionally with a proposed change (other dates or fewer days).
   */
  endorse: async (id: string, note?: string, proposal?: LeaveChange) => {
    const res = await api.patch(`/leave/${id}/endorse`, { note, proposal });
    return res.data;
  },

  /**
   * HR's final approval: as requested, the head's proposed change
   * (`{ useProposal: true }`), or HR's own revised dates.
   */
  approve: async (id: string, hrNotes?: string, revision?: LeaveChange | { useProposal: true; reason?: string }) => {
    const res = await api.patch(`/leave/${id}/approve`, { hrNotes, revision });
    return res.data;
  },

  /** Decline — a reason is required. */
  reject: async (id: string, rejectionReason: string) => {
    const res = await api.patch(`/leave/${id}/reject`, { rejectionReason });
    return res.data;
  },

  /** The employee withdraws their own request before the final decision. */
  cancel: async (id: string) => {
    const res = await api.patch(`/leave/${id}/cancel`);
    return res.data;
  },

  /** The completed-years entitlement, explained, next to the balance held. */
  getEntitlements: async (employeeId?: string) => {
    const res = await api.get('/leave/entitlements', { params: { employeeId } });
    return res.data;
  },

  /** HR switches a manual balance to the automatic entitlement. */
  applyEntitlement: async (employeeId: string, leaveType: string) => {
    const res = await api.post(`/leave/entitlements/${employeeId}/apply`, { leaveType });
    return res.data;
  },

  /** HR brings every active employee's automatic balances up to date. */
  syncEntitlements: async () => {
    const res = await api.post('/leave/entitlements/sync');
    return res.data;
  },

  /**
   * HR enters a balance by hand (MANUAL). The automatic entitlement never
   * overrides a manual figure.
   */
  upsertBalance: async (data: {
    employeeId: string;
    year: number;
    leaveType: string;
    totalAllotted: number;
    forfeited?: number;
  }) => {
    const res = await api.put('/leave/balances', data);
    return res.data;
  },
};
