import { api } from './api';

/** Yearly Achievements (API: /achievements). Drafts are returned to HR only. */

export type AchievementStatus = 'DRAFT' | 'PUBLISHED';

export interface AchievementPageSummary {
  id: string;
  year: number;
  title: string;
  summary: string | null;
  status: AchievementStatus;
  isSample: boolean;
  publishedAt: string | null;
  updatedAt: string;
  entryCount: number;
}

export interface AchievementEntry {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  attachment: { name: string | null; mime: string | null; isImage: boolean } | null;
}

export interface AchievementPage extends Omit<AchievementPageSummary, 'entryCount'> {
  entries: AchievementEntry[];
}

const data = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

const form = (fields: Record<string, string | boolean | undefined>, file?: File | null) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, String(v));
  if (file) fd.append('attachment', file);
  return fd;
};

export const AchievementsService = {
  list: () => data<AchievementPageSummary[]>(api.get('/achievements')),
  get: (id: string) => data<AchievementPage>(api.get(`/achievements/${id}`)),
  create: (body: { year: number; title?: string; summary?: string }) => data<AchievementPage>(api.post('/achievements', body)),
  update: (id: string, body: Partial<{ year: number; title: string; summary: string; status: AchievementStatus }>) => data<AchievementPage>(api.patch(`/achievements/${id}`, body)),
  remove: async (id: string): Promise<void> => {
    await api.delete(`/achievements/${id}`);
  },
  addEntry: (pageId: string, title: string, description: string, file?: File | null) =>
    data<AchievementPage>(api.post(`/achievements/${pageId}/entries`, form({ title, description }, file))),
  updateEntry: (entryId: string, fields: { title?: string; description?: string; removeAttachment?: boolean }, file?: File | null) =>
    data<AchievementPage>(api.patch(`/achievements/entries/${entryId}`, form(fields, file))),
  moveEntry: (entryId: string, direction: 'up' | 'down') => data<AchievementPage>(api.post(`/achievements/entries/${entryId}/move`, { direction })),
  deleteEntry: (entryId: string) => data<AchievementPage>(api.delete(`/achievements/entries/${entryId}`)),
  /** Path for ProtectedImage / an authenticated download. */
  attachmentPath: (entryId: string) => `/achievements/entries/${entryId}/attachment`,
  openAttachment: async (entryId: string) => {
    const res = await api.get(`/achievements/entries/${entryId}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
