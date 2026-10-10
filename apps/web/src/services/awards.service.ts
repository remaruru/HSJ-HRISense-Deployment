import { api } from './api';

/** Awards & Recognition (API: /awards). The API never returns who voted for whom. */

export type AwardType = 'EMPLOYEE_OF_THE_QUARTER' | 'VINCENTIAN' | 'LOUISIAN' | 'SPECIAL' | 'LONGEVITY' | 'CUSTOM';
export type AwardStatus = 'DRAFT' | 'NOMINATION_OPEN' | 'NOMINATION_CLOSED' | 'VOTING_OPEN' | 'VOTING_CLOSED' | 'DELIBERATION' | 'VERIFIED' | 'FINALIZED';
export type AwardAction = 'OPEN_NOMINATION' | 'CLOSE_NOMINATION' | 'OPEN_VOTING' | 'CLOSE_VOTING' | 'START_REVIEW' | 'VERIFY' | 'RETURN_TO_REVIEW' | 'FINALIZE';
export type AwardDecision = 'PENDING' | 'CONFIRMED' | 'NOT_AWARDED';

export const AWARD_TYPE_LABEL: Record<AwardType, string> = {
  EMPLOYEE_OF_THE_QUARTER: 'Employee of the Quarter',
  VINCENTIAN: 'Vincentian Service Award',
  LOUISIAN: 'Louisian Service Award',
  SPECIAL: 'Special Awards',
  LONGEVITY: 'Longevity Awards',
  CUSTOM: 'Custom award',
};

export const AWARD_ACTION_LABEL: Record<AwardAction, string> = {
  OPEN_NOMINATION: 'Open nomination',
  CLOSE_NOMINATION: 'Close nomination',
  OPEN_VOTING: 'Open voting',
  CLOSE_VOTING: 'Close voting',
  START_REVIEW: 'Review results',
  VERIFY: 'Verify results',
  RETURN_TO_REVIEW: 'Return to review',
  FINALIZE: 'Declare final results',
};

export interface AwardPerson {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobRoleTitle: string;
  unitName: string;
}

export interface AwardGroup {
  id: string;
  name: string;
  description: string | null;
  isOfficial: boolean;
  unitIds: string[];
  departmentIds: string[];
  jobRoleIds: string[];
  employeeIds: string[];
  memberCount: number;
  hospicioTerms: string[];
  unresolvedTerms: string[];
}

export interface AwardSummary {
  id: string;
  type: AwardType;
  isOfficial: boolean;
  title: string;
  periodLabel: string;
  year: number;
  quarter: number | null;
  status: AwardStatus;
  statusLabel: string;
  actions: AwardAction[];
  usesNomination: boolean;
  usesVoting: boolean;
  finalizedAt: string | null;
  _count?: { ballots: number; categories: number };
}

export interface AwardResultRow {
  id: string | null;
  employeeId: string;
  categoryId: string | null;
  voteCount: number;
  rank: number | null;
  shortlisted: boolean;
  tiedAtCutoff: boolean;
  completedYears: number | null;
  decision: AwardDecision;
  placement: number | null;
  note: string | null;
  employee: AwardPerson | null;
}

export interface AwardDetail extends AwardSummary {
  description: string | null;
  requiresConfirmation: boolean;
  resultMode: 'PER_CATEGORY' | 'COMBINED';
  shortlistCount: number | null;
  eligibilityDate: string;
  minYears: number | null;
  maxYears: number | null;
  excludeHallOfFame: boolean;
  excludedJobRoleIds: string[];
  excludedJobRoles: string[];
  totalVotesPerVoter: number;
  categories: Array<{
    id: string;
    title: string;
    votesPerVoter: number;
    milestoneYears: number | null;
    nomineeGroupId: string | null;
    voterGroupId: string | null;
    nomineeGroupName: string | null;
    voterGroupName: string | null;
    candidates: AwardPerson[];
    nominationCount: number;
  }>;
  nominations: Array<{
    id: string;
    categoryId: string;
    createdAt: string;
    reason: string | null;
    nominee: AwardPerson;
    nominatedBy: AwardPerson;
    stillEligible: boolean;
    ineligibleReason: string | null;
  }>;
  turnout: { ballots: number; eligibleVoters: number } | null;
  results: AwardResultRow[] | null;
  verifiedAt: string | null;
  reviewStartedAt: string | null;
}

export interface MyAwards {
  nominationAwards: Array<{
    id: string;
    title: string;
    periodLabel: string;
    description: string | null;
    isOfficial: boolean;
    categories: Array<{ id: string; title: string; groupName: string; options: AwardPerson[]; myNominations: AwardPerson[] }>;
  }>;
  votingAwards: Array<{
    id: string;
    title: string;
    periodLabel: string;
    description: string | null;
    isOfficial: boolean;
    submittedAt: string | null;
    categories: Array<{ id: string; title: string; votesPerVoter: number; groupName: string | null; canVote: boolean; candidates: AwardPerson[]; myVotes: AwardPerson[] }>;
  }>;
  results: Array<{
    id: string;
    title: string;
    periodLabel: string;
    type: AwardType;
    finalizedAt: string | null;
    resultMode: 'PER_CATEGORY' | 'COMBINED';
    awardees: Array<{ categoryTitle: string | null; placement: number | null; employee: AwardPerson }>;
  }>;
  myHistory: {
    awards: Array<{ award: string; category: string | null; period: string; placement: number | null; finalizedAt: string | null }>;
    hallOfFame: Array<{ awardYear: number; title: string; conferredOn: string | null }>;
  };
  isHallOfFame: boolean;
}

export interface HistoryAward {
  id: string;
  type: AwardType;
  isOfficial: boolean;
  title: string;
  periodLabel: string;
  finalizedAt: string | null;
  resultMode: 'PER_CATEGORY' | 'COMBINED';
  awardees: Array<{ categoryTitle: string | null; placement: number | null; voteCount: number; completedYears: number | null; employee: AwardPerson }>;
}

export interface HallOfFameRow {
  id: string;
  employeeId: string;
  awardYear: number;
  title: string;
  conferredOn: string | null;
  notes: string | null;
  employee: AwardPerson;
}

const data = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const AwardsService = {
  my: () => data<MyAwards>(api.get('/awards/my')),
  nominate: (categoryId: string, nomineeId: string, reason?: string) => api.post(`/awards/categories/${categoryId}/nominations`, { nomineeId, reason }),
  vote: (awardId: string, selections: Array<{ categoryId: string; nomineeIds: string[] }>) => api.post(`/awards/${awardId}/ballot`, { selections }),

  list: () => data<AwardSummary[]>(api.get('/awards')),
  get: (id: string) => data<AwardDetail>(api.get(`/awards/${id}`)),
  create: (body: any) => data<AwardDetail>(api.post('/awards', body)),
  createRecognitionYear: (year: number, eligibilityDate?: string) =>
    data<{ created: string[]; skipped: string[] }>(api.post('/awards/recognition-year', { year, eligibilityDate })),
  update: (id: string, body: any) => data<AwardDetail>(api.patch(`/awards/${id}`, body)),
  remove: (id: string) => api.delete(`/awards/${id}`),
  transition: (id: string, action: AwardAction) => data<AwardDetail>(api.post(`/awards/${id}/transition`, { action })),
  decide: (resultId: string, body: { decision: AwardDecision; placement?: number | null; note?: string }) => data<AwardDetail>(api.patch(`/awards/results/${resultId}`, body)),
  confirmShortlist: (id: string) => data<AwardDetail>(api.post(`/awards/${id}/confirm-shortlist`)),
  history: () => data<HistoryAward[]>(api.get('/awards/history')),

  groups: () => data<AwardGroup[]>(api.get('/awards/groups')),
  saveGroup: (id: string | null, body: Partial<AwardGroup>) =>
    data<AwardGroup[]>(id ? api.put(`/awards/groups/${id}`, body) : api.post('/awards/groups', body)),
  deleteGroup: (id: string) => data<AwardGroup[]>(api.delete(`/awards/groups/${id}`)),

  hallOfFame: () => data<HallOfFameRow[]>(api.get('/awards/hall-of-fame')),
  recordHallOfFame: (body: { employeeId: string; awardYear: number; title?: string; conferredOn?: string; notes?: string }) =>
    data<HallOfFameRow[]>(api.post('/awards/hall-of-fame', body)),
  removeHallOfFame: (id: string) => data<HallOfFameRow[]>(api.delete(`/awards/hall-of-fame/${id}`)),
};
