import { CycleWorkflowTable } from './components/CycleWorkflowTable';
import { EvaluationParticipantsDialog } from './components/EvaluationParticipantsDialog';
import { EVALUATION_MODE_LABEL, RATER_TYPE_LABEL, type SubjectProgress } from '@/services/evaluation.service';
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Plus,
  Search,
  SearchX,
  CheckCircle2,
  Clock,
  Hourglass,
  PenLine,
  AlertCircle,
  FileText,
  Eye,
  Edit2,
  PowerOff,
  RefreshCw,
  Calendar,
  Layers,
  ClipboardList,
  UserCheck,
  Lock,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { TabNav, type TabNavItem } from '@/components/ui/tab-nav';
import {
  Toolbar,
  ToolbarSpacer,
  SearchField,
  FilterSelect,
} from '@/components/ui/toolbar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  EvaluationService,
  EvaluationTemplate,
  EvaluationCycle,
  EvaluationAssignment,
  RatingPresetId,
  resolveRatingPreset,
  EvaluationCycleStatus,
  EvaluationAssignmentStatus,
  formatEvaluationResult,
} from '@/services/evaluation.service';
import { EvaluationTemplateModal } from './components/EvaluationTemplateModal';
import { EvaluationTemplateViewer, TemplateOriginBadge } from './components/EvaluationTemplateViewer';
import { CycleModeCard } from './components/CycleModeCard';
import { EvaluationCycleModal } from './components/EvaluationCycleModal';
import { EvaluationFormModal } from './components/EvaluationFormModal';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/* ─── Shared Panel Classes ───────────────────────────────────────────────────── */

/** Card shell used by every table panel on this page, so the three tabs match. */
const PANEL_CLASS =
  'rounded-2xl border border-border-soft bg-surface overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

/** Table header styling, kept identical across the three tables. */
const TABLE_HEAD_CLASS = 'bg-surface-2/70 text-muted-foreground border-b border-border-soft';

/* ─── Mapping Helpers ────────────────────────────────────────────────────────── */

/**
 * Badge styling per rating PRESET (see `RATING_PRESETS`). The database stores
 * only NUMERIC and LABELED; the preset a template was built from is recovered
 * from its `scoreLabels`, so the list keeps showing "5-Point Scale" /
 * "4-Point Satisfaction" / "Written / Descriptive" as HR chose them.
 */
const RATING_PRESET_BADGE: Record<RatingPresetId, string> = {
  NUMERIC:
    'bg-status-info-surface text-status-info-foreground border-status-info-border',
  LIKERT_5:
    'bg-status-accent-surface text-status-accent-foreground border-status-accent-border',
  SATISFACTION_4:
    'bg-status-accent-surface text-status-accent-foreground border-status-accent-border',
  DESCRIPTIVE:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

/** Resolves a template to the preset label + badge classes shown in the list. */
function ratingPresetMeta(template: { ratingMethod?: any; scoreLabels?: unknown }) {
  const preset = resolveRatingPreset(template);
  return { label: preset.title, badgeClass: RATING_PRESET_BADGE[preset.id] };
}

const CYCLE_STATUS_META: Record<EvaluationCycleStatus, { label: string; badgeClass: string; icon: any }> = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
    icon: Clock,
  },
  ACTIVE: {
    label: 'Active',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
    icon: CheckCircle2,
  },
  CLOSED: {
    label: 'Closed',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: AlertCircle,
  },
};

const EVALUATOR_METHOD_LABELS: Record<string, string> = {
  ONE_EVALUATOR: 'One Designated Evaluator',
  SUPERVISOR: 'Immediate Supervisor',
  MANUAL: 'Manual / Custom Assignment',
};

const ASSIGNMENT_STATUS_META: Record<EvaluationAssignmentStatus, { label: string; badgeClass: string }> = {
  NOT_STARTED: {
    label: 'Not Started',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-status-info-surface text-status-info-foreground border-status-info-border',
  },
  SUBMITTED: {
    label: 'Awaiting Finalization',
    badgeClass: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
  },
  FINALIZED: {
    label: 'Completed',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
  },
};

/* ─── Main Page Component ────────────────────────────────────────────────────── */

export default function EvaluationsPage() {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === 'FULL';

  // Workspace Tabs
  const [activeTab, setActiveTab] = useState<'cycles' | 'templates' | 'my-evaluations'>(
    isFullHR ? 'cycles' : 'my-evaluations'
  );

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  /** Set alongside the toast so the failure is also visible inline in the panel. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycles, setCycles] = useState<EvaluationCycle[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [assignments, setAssignments] = useState<EvaluationAssignment[]>([]);

  // Search & Filters
  const [cycleSearch, setCycleSearch] = useState<string>('');
  const [cycleStatusFilter, setCycleStatusFilter] = useState<string>('ALL');

  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<string>('ALL');

  const [myEvalSearch, setMyEvalSearch] = useState<string>('');
  const [myEvalStatusFilter, setMyEvalStatusFilter] = useState<string>('ALL');

  // Cycle Detail Assignment Search & Filter
  const [cycleDetailAssignmentSearch, setCycleDetailAssignmentSearch] = useState<string>('');
  const [cycleDetailAssignmentStatusFilter, setCycleDetailAssignmentStatusFilter] = useState<string>('ALL');

  // Detail & Action Modal States
  const [selectedTemplate, setSelectedTemplate] = useState<EvaluationTemplate | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<EvaluationCycle | null>(null);
  const [loadingCycleDetail, setLoadingCycleDetail] = useState<boolean>(false);

  // Interactive Evaluation Form Modal (Draft, Submit, Finalize, Review)
  const [evaluationModalOpen, setEvaluationModalOpen] = useState<boolean>(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  // Template Form Modal (Create / Edit)
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);
  const [templateToEdit, setTemplateToEdit] = useState<EvaluationTemplate | null>(null);

  // Cycle Form Modal (Create)
  const [cycleModalOpen, setCycleModalOpen] = useState<boolean>(false);

  // Template Deactivate State
  const [templateToDeactivate, setTemplateToDeactivate] = useState<EvaluationTemplate | null>(null);
  const [deactivating, setDeactivating] = useState<boolean>(false);

  // Cycle Close State
  const [cycleToClose, setCycleToClose] = useState<EvaluationCycle | null>(null);
  const [closingCycle, setClosingCycle] = useState<boolean>(false);

  // Evaluators for one employee in the open cycle (HR)
  const [participantsEmployeeId, setParticipantsEmployeeId] = useState<string | null>(null);
  const participantsSubject: SubjectProgress | null =
    selectedCycle?.subjects?.find((s) => s.employeeId === participantsEmployeeId) ?? null;

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isFullHR) {
        const [cyclesData, templatesData, assignmentsData] = await Promise.all([
          EvaluationService.listCycles(),
          EvaluationService.listTemplates(),
          EvaluationService.listAssignments(),
        ]);
        setCycles(cyclesData);
        setTemplates(templatesData);
        setAssignments(assignmentsData);
      } else {
        const assignmentsData = await EvaluationService.listAssignments();
        setAssignments(assignmentsData);
      }
    } catch (err: any) {
      setLoadError(
        getApiErrorMessage(err, 'Unable to connect to the HRISense server. Please try again.')
      );
      toast.error('Unable to connect to the HRISense server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isFullHR]);

  const myEmployeeId = user?.employee?.id;

  // What the signed-in person has to complete (self, peer or head ratings) and
  // their own visible results. HR's admin view of everyone is the Cycles tab.
  const myAssignments = useMemo(() => {
    if (!myEmployeeId) return [];
    return assignments.filter(
      (a) =>
        a.evaluatorId === myEmployeeId ||
        (a.employeeId === myEmployeeId && a.raterType === 'HEAD' && a.status === 'FINALIZED' && a.isEmployeeVisible)
    );
  }, [assignments, myEmployeeId]);

  // Derived KPI Metrics. HR: employees evaluated in active cycles (one per
  // employee, not per rater). Everyone else: their own rating tasks.
  const summaryMetrics = useMemo(() => {
    if (isFullHR) {
      const active = cycles.filter((c) => c.status === 'ACTIVE');
      const sum = (k: 'total' | 'notStarted' | 'inProgress' | 'submitted' | 'finalized') =>
        active.reduce((n, c) => n + (c.metrics?.[k] ?? 0), 0);
      return { active: sum('total') - sum('finalized'), notStarted: sum('notStarted'), inProgress: sum('inProgress'), submitted: sum('submitted'), finalized: sum('finalized') };
    }
    const tasks = myAssignments.filter((a) => a.evaluatorId === myEmployeeId);
    return {
      active: tasks.filter((a) => a.status !== 'FINALIZED').length,
      notStarted: tasks.filter((a) => a.status === 'NOT_STARTED').length,
      inProgress: tasks.filter((a) => a.status === 'IN_PROGRESS').length,
      submitted: tasks.filter((a) => a.status === 'SUBMITTED').length,
      finalized: tasks.filter((a) => a.status === 'FINALIZED').length,
    };
  }, [isFullHR, cycles, myAssignments, myEmployeeId]);

  // Filtered lists
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      const matchesSearch =
        !cycleSearch ||
        c.name.toLowerCase().includes(cycleSearch.toLowerCase()) ||
        c.description?.toLowerCase().includes(cycleSearch.toLowerCase());
      const matchesStatus = cycleStatusFilter === 'ALL' || c.status === cycleStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cycles, cycleSearch, cycleStatusFilter]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        !templateSearch ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        t.description?.toLowerCase().includes(templateSearch.toLowerCase());
      const matchesStatus =
        templateStatusFilter === 'ALL' ||
        (templateStatusFilter === 'ACTIVE' && t.isActive) ||
        (templateStatusFilter === 'INACTIVE' && !t.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [templates, templateSearch, templateStatusFilter]);

  const filteredMyAssignments = useMemo(() => {
    return myAssignments.filter((a) => {
      const empName = `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.toLowerCase();
      const empNum = (a.employee?.employeeNumber || '').toLowerCase();
      const cycleName = (a.cycle?.name || '').toLowerCase();
      const query = myEvalSearch.toLowerCase();
      const matchesSearch = !myEvalSearch || empName.includes(query) || empNum.includes(query) || cycleName.includes(query);
      const matchesStatus = myEvalStatusFilter === 'ALL' || a.status === myEvalStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [myAssignments, myEvalSearch, myEvalStatusFilter]);

  // Employees in the open cycle, filtered (one row per employee evaluated)
  const filteredCycleSubjects = useMemo(() => {
    if (!selectedCycle?.subjects) return [];
    return selectedCycle.subjects.filter((s) => {
      const empName = `${s.employee?.firstName || ''} ${s.employee?.lastName || ''}`.toLowerCase();
      const empNum = (s.employee?.employeeNumber || '').toLowerCase();
      const head = s.head?.evaluator ? `${s.head.evaluator.firstName} ${s.head.evaluator.lastName}`.toLowerCase() : '';
      const q = cycleDetailAssignmentSearch.toLowerCase();
      const matchesSearch = !q || empName.includes(q) || empNum.includes(q) || head.includes(q);
      const matchesStatus = cycleDetailAssignmentStatusFilter === 'ALL' || s.stage === cycleDetailAssignmentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [selectedCycle, cycleDetailAssignmentSearch, cycleDetailAssignmentStatusFilter]);

  // View Detailed Cycle
  const handleOpenCycleDetail = async (cycle: EvaluationCycle) => {
    setSelectedCycle(cycle);
    setCycleDetailAssignmentSearch('');
    setCycleDetailAssignmentStatusFilter('ALL');
    setLoadingCycleDetail(true);
    try {
      const fullCycle = await EvaluationService.getCycle(cycle.id);
      setSelectedCycle(fullCycle);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to load full cycle details.'));
    } finally {
      setLoadingCycleDetail(false);
    }
  };

  // Open Interactive Evaluation Assignment Form
  const handleOpenEvaluationForm = (assignmentId: string) => {
    setActiveAssignmentId(assignmentId);
    setEvaluationModalOpen(true);
  };

  // Template Actions
  const handleCreateTemplate = () => {
    setTemplateToEdit(null);
    setTemplateModalOpen(true);
  };

  const handleEditTemplate = (template: EvaluationTemplate) => {
    setTemplateToEdit(template);
    setTemplateModalOpen(true);
  };

  const handleDeactivateTemplate = (template: EvaluationTemplate) => {
    setTemplateToDeactivate(template);
  };

  const confirmDeactivate = async () => {
    if (!templateToDeactivate) return;
    setDeactivating(true);
    try {
      await EvaluationService.deactivateTemplate(templateToDeactivate.id);
      toast.success(`Evaluation template "${templateToDeactivate.name}" deactivated.`);
      setTemplateToDeactivate(null);
      fetchData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to deactivate template.'));
    } finally {
      setDeactivating(false);
    }
  };

  // Cycle Actions
  const handleCreateCycle = () => {
    setCycleModalOpen(true);
  };

  const handleCloseCycle = (cycle: EvaluationCycle) => {
    setCycleToClose(cycle);
  };

  const confirmCloseCycle = async () => {
    if (!cycleToClose) return;
    setClosingCycle(true);
    try {
      await EvaluationService.closeCycle(cycleToClose.id);
      toast.success(`Evaluation cycle "${cycleToClose.name}" has been closed.`);
      setCycleToClose(null);
      if (selectedCycle?.id === cycleToClose.id) {
        setSelectedCycle(null);
      }
      fetchData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to close evaluation cycle.'));
    } finally {
      setClosingCycle(false);
    }
  };

  const cycleFiltersActive = Boolean(cycleSearch) || cycleStatusFilter !== 'ALL';
  const templateFiltersActive = Boolean(templateSearch) || templateStatusFilter !== 'ALL';
  const myEvalFiltersActive = Boolean(myEvalSearch) || myEvalStatusFilter !== 'ALL';

  const clearCycleFilters = () => {
    setCycleSearch('');
    setCycleStatusFilter('ALL');
  };

  const clearTemplateFilters = () => {
    setTemplateSearch('');
    setTemplateStatusFilter('ALL');
  };

  const clearMyEvalFilters = () => {
    setMyEvalSearch('');
    setMyEvalStatusFilter('ALL');
  };

  const tabItems: TabNavItem<'cycles' | 'templates' | 'my-evaluations'>[] = [
    ...(isFullHR
      ? ([
          {
            id: 'cycles' as const,
            label: 'Evaluation Cycles',
            icon: <Calendar className="h-4 w-4" />,
            count: cycles.length,
          },
          {
            id: 'templates' as const,
            label: 'Evaluation Templates',
            icon: <FileText className="h-4 w-4" />,
            count: templates.length,
          },
        ])
      : []),
    {
      id: 'my-evaluations' as const,
      label: 'My Evaluations',
      icon: <UserCheck className="h-4 w-4" />,
      count: myAssignments.length,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ─── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Performance Evaluations"
        subtitle="Manage evaluation forms, evaluation periods, assignments, and completed reviews."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh evaluation data"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>

            {isFullHR && (
              <>
                <Button
                  variant="create"
                  size="sm"
                  onClick={handleCreateTemplate}
                  className="gap-1.5 whitespace-nowrap">
                  <FileText className="h-4 w-4" />
                  New Template
                </Button>
                <Button
                  variant="create"
                  size="sm"
                  onClick={handleCreateCycle}
                  className="gap-1.5 whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  New Evaluation Cycle
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ─── Summary Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          tone="total"
          label={isFullHR ? 'Employees Under Review' : 'My Open Ratings'}
          value={summaryMetrics.active}
          hint={isFullHR ? 'Employees in active cycles, not finalized' : 'Self, peer and head ratings to do'}
          loading={loading}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          tone="neutral"
          label="Not Started"
          value={summaryMetrics.notStarted}
          hint="Awaiting evaluator start"
          loading={loading}
        />
        <StatCard
          icon={<PenLine className="h-4 w-4" />}
          tone="info"
          label="In Progress"
          value={summaryMetrics.inProgress}
          hint="Draft evaluations"
          loading={loading}
        />
        <StatCard
          icon={<Hourglass className="h-4 w-4" />}
          tone="warning"
          label={isFullHR ? 'Head Evaluation Submitted' : 'Submitted'}
          value={summaryMetrics.submitted}
          hint={isFullHR ? 'Discussion or HR finalization pending' : 'Waiting for HR'}
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          label="Completed"
          value={summaryMetrics.finalized}
          hint="Finalized and recorded"
          loading={loading}
        />
      </div>

      {/* ─── Workspace Tabs ───────────────────────────────────────────────────── */}
      <TabNav
        aria-label="Evaluation workspace"
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* ─── TAB 1: Evaluation Cycles ─────────────────────────────────────────── */}
      {activeTab === 'cycles' && isFullHR && (
        <div
          role="tabpanel"
          id="tabpanel-cycles"
          aria-labelledby="tab-cycles"
          className="space-y-4"
        >
          <Toolbar>
            <SearchField
              label="Search evaluation cycles"
              placeholder="Search evaluation cycles..."
              value={cycleSearch}
              onValueChange={setCycleSearch}
            />
            <FilterSelect
              label="Filter cycles by status"
              value={cycleStatusFilter}
              onChange={(e) => setCycleStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
              <option value="DRAFT">Draft</option>
            </FilterSelect>

            <ToolbarSpacer />

            {cycleFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCycleFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </Toolbar>

          {/* Cycles Table */}
          <div className={PANEL_CLASS}>
            {loading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : loadError ? (
              <EmptyState
                variant="error"
                icon={<AlertCircle className="h-5 w-5" />}
                title="Couldn't load evaluation cycles"
                description={loadError}
                action={
                  <Button variant="subtle" size="sm" onClick={fetchData} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </Button>
                }
              />
            ) : cycles.length === 0 ? (
              <EmptyState
                variant="onboarding"
                icon={<Calendar className="h-7 w-7" />}
                title="No evaluation cycles yet"
                description="Create a cycle to choose which employees will be evaluated, when reviews are due, and who will evaluate them."
                action={
                  <Button variant="create" size="sm" onClick={handleCreateCycle} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Create Evaluation Cycle
                  </Button>
                }
              />
            ) : filteredCycles.length === 0 ? (
              <EmptyState
                variant="filtered"
                icon={<SearchX className="h-5 w-5" />}
                title="No matching evaluation cycles"
                description="No cycle matches your current keyword or status filter. Try a different term, or clear the filters to see all cycles."
                action={
                  <Button variant="subtle" size="sm" onClick={clearCycleFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Evaluation cycles, {filteredCycles.length} of {cycles.length} shown
                  </caption>
                  <thead className={TABLE_HEAD_CLASS}>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider">
                      <th scope="col" className="px-5 py-3">Evaluation Cycle</th>
                      <th scope="col" className="px-5 py-3">Form Template</th>
                      <th scope="col" className="px-5 py-3">Period</th>
                      <th scope="col" className="px-5 py-3">Status</th>
                      <th scope="col" className="px-5 py-3">Assigned</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {filteredCycles.map((cycle) => {
                      const statusMeta = CYCLE_STATUS_META[cycle.status] || CYCLE_STATUS_META.DRAFT;
                      const StatusIcon = statusMeta.icon;
                      const assignedCount =
                        cycle.metrics?.total ?? cycle.assignments?.length ?? cycle._count?.assignments ?? 0;
                      return (
                        <tr key={cycle.id} className="transition-colors hover:bg-surface-2/60">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-foreground leading-snug">{cycle.name}</p>
                            {cycle.description && (
                              <p className="mt-0.5 max-w-sm line-clamp-1 text-[11px] text-muted-foreground">
                                {cycle.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-xs font-medium text-foreground">
                              {cycle.template?.name || 'Unassigned Template'}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {EVALUATION_MODE_LABEL[cycle.evaluationMode] ?? ''}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(cycle.startDate).toLocaleDateString()} –{' '}
                            {new Date(cycle.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              label={statusMeta.label}
                              className={statusMeta.badgeClass}
                              icon={<StatusIcon className="h-3.5 w-3.5" />}
                            />
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {assignedCount}
                            </span>
                            <span className="ml-1 text-[11px] text-muted-foreground">employees</span>
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="review"
                                size="sm"
                                onClick={() => handleOpenCycleDetail(cycle)}
                                aria-label={`View details for ${cycle.name}`}
                                className="gap-1.5 text-xs">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>

                              {cycle.status === 'ACTIVE' && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleCloseCycle(cycle)}
                                  title="Close evaluation cycle"
                                  aria-label={`Close evaluation cycle ${cycle.name}`}
                                  className="text-muted-foreground hover:bg-danger-light hover:text-danger-dark dark:hover:bg-danger/15 dark:hover:text-danger"
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Evaluation Templates ──────────────────────────────────────── */}
      {activeTab === 'templates' && isFullHR && (
        <div
          role="tabpanel"
          id="tabpanel-templates"
          aria-labelledby="tab-templates"
          className="space-y-4"
        >
          <Toolbar>
            <SearchField
              label="Search evaluation templates"
              placeholder="Search templates..."
              value={templateSearch}
              onValueChange={setTemplateSearch}
            />
            <FilterSelect
              label="Filter templates by status"
              value={templateStatusFilter}
              onChange={(e) => setTemplateStatusFilter(e.target.value)}
            >
              <option value="ALL">All Templates</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </FilterSelect>

            <ToolbarSpacer />

            {templateFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearTemplateFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </Toolbar>

          {/* Templates Table */}
          <div className={PANEL_CLASS}>
            {loading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : loadError ? (
              <EmptyState
                variant="error"
                icon={<AlertCircle className="h-5 w-5" />}
                title="Couldn't load evaluation templates"
                description={loadError}
                action={
                  <Button variant="subtle" size="sm" onClick={fetchData} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </Button>
                }
              />
            ) : templates.length === 0 ? (
              <EmptyState
                variant="onboarding"
                icon={<FileText className="h-7 w-7" />}
                title="No evaluation templates yet"
                description="Create a template to define the criteria and rating method used in employee evaluations."
                action={
                  <Button variant="create" size="sm" onClick={handleCreateTemplate} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Create Evaluation Template
                  </Button>
                }
              />
            ) : filteredTemplates.length === 0 ? (
              <EmptyState
                variant="filtered"
                icon={<SearchX className="h-5 w-5" />}
                title="No matching evaluation templates"
                description="No template matches your current keyword or status filter. Try a different term, or clear the filters to see all templates."
                action={
                  <Button variant="subtle" size="sm" onClick={clearTemplateFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Evaluation templates, {filteredTemplates.length} of {templates.length} shown
                  </caption>
                  <thead className={TABLE_HEAD_CLASS}>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider">
                      <th scope="col" className="px-5 py-3">Template Name</th>
                      <th scope="col" className="px-5 py-3">Rating Method</th>
                      <th scope="col" className="px-5 py-3">Criteria</th>
                      <th scope="col" className="px-5 py-3">Scoring</th>
                      <th scope="col" className="px-5 py-3">Status</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {filteredTemplates.map((template) => {
                      const ratingMeta = ratingPresetMeta(template);
                      return (
                        <tr key={template.id} className="transition-colors hover:bg-surface-2/60">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-foreground leading-snug">{template.name}</p>
                            <div className="mt-1"><TemplateOriginBadge template={template} /></div>
                            {template.description && (
                              <p className="mt-0.5 max-w-sm line-clamp-1 text-[11px] text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              size="sm"
                              label={ratingMeta.label}
                              className={ratingMeta.badgeClass}
                            />
                          </td>
                          <td className="px-5 py-4 align-top">
                            {template.groups?.length ? (
                              <>
                                <span className="text-sm font-semibold text-foreground tabular-nums">{template.groups.length}</span>
                                <span className="ml-1 text-[11px] text-muted-foreground">areas ·</span>
                                <span className="ml-1 text-sm font-semibold text-foreground tabular-nums">{template.criteria?.length || 0}</span>
                                <span className="ml-1 text-[11px] text-muted-foreground">statements</span>
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-semibold text-foreground tabular-nums">{template.criteria?.length || 0}</span>
                                <span className="ml-1 text-[11px] text-muted-foreground">criteria</span>
                              </>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              size="sm"
                              label={
                                template.scoringMethod === 'AREA_AVERAGE'
                                  ? template.formLayout?.weightsSource === 'FORM_FORMULA' ? 'Form formula' : 'Area average'
                                  : template.scoringMethod === 'AREA_WEIGHTED'
                                    ? 'Weighted areas'
                                    : template.useWeighting ? 'Weighted' : 'Equal'
                              }
                              className={
                                template.useWeighting
                                  ? 'bg-status-accent-surface text-status-accent-foreground border-status-accent-border'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }
                            />
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge
                              size="sm"
                              label={template.isActive ? 'Active' : 'Inactive'}
                              className={
                                template.isActive
                                  ? 'bg-status-success-surface text-status-success-foreground border-status-success-border'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }
                            />
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="review"
                                size="sm"
                                onClick={() => setSelectedTemplate(template)}
                                aria-label={`View criteria for ${template.name}`}
                                className="gap-1.5 text-xs">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>

                              {/* Official Hospicio forms: view, use in cycles, duplicate — never edit. */}
                              {!template.isOfficial && (
                                <Button
                                  variant="update"
                                  size="icon-sm"
                                  onClick={() => handleEditTemplate(template)}
                                  title="Edit template"
                                  aria-label={`Edit template ${template.name}`}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {template.isActive && !template.isOfficial && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleDeactivateTemplate(template)}
                                  title="Deactivate template"
                                  aria-label={`Deactivate template ${template.name}`}
                                  className="text-muted-foreground hover:bg-danger-light hover:text-danger-dark dark:hover:bg-danger/15 dark:hover:text-danger"
                                >
                                  <PowerOff className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: My Evaluations (Evaluator Workspace) ──────────────────────── */}
      {activeTab === 'my-evaluations' && (
        <div
          role="tabpanel"
          id="tabpanel-my-evaluations"
          aria-labelledby="tab-my-evaluations"
          className="space-y-4"
        >
          <Toolbar>
            <SearchField
              label="Search my evaluations"
              placeholder="Search employee or cycle..."
              value={myEvalSearch}
              onValueChange={setMyEvalSearch}
            />
            <FilterSelect
              label="Filter my evaluations by status"
              value={myEvalStatusFilter}
              onChange={(e) => setMyEvalStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Awaiting Finalization</option>
              <option value="FINALIZED">Completed</option>
            </FilterSelect>

            <ToolbarSpacer />

            {myEvalFiltersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMyEvalFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </Toolbar>

          {/* My Assignments Table */}
          <div className={PANEL_CLASS}>
            {loading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : loadError ? (
              <EmptyState
                variant="error"
                icon={<AlertCircle className="h-5 w-5" />}
                title="Couldn't load your evaluations"
                description={loadError}
                action={
                  <Button variant="subtle" size="sm" onClick={fetchData} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </Button>
                }
              />
            ) : myAssignments.length === 0 ? (
              <EmptyState
                variant="onboarding"
                icon={<ClipboardList className="h-7 w-7" />}
                title="No evaluation assignments yet"
                description="Your self rating, and any peer or head evaluations HR assigns to you, appear here when an evaluation cycle is underway."
              />
            ) : filteredMyAssignments.length === 0 ? (
              <EmptyState
                variant="filtered"
                icon={<SearchX className="h-5 w-5" />}
                title="No matching evaluations"
                description="No assignment matches your current keyword or status filter. Try a different term, or clear the filters to see all of your evaluations."
                action={
                  <Button variant="subtle" size="sm" onClick={clearMyEvalFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    My evaluation assignments, {filteredMyAssignments.length} of {myAssignments.length} shown
                  </caption>
                  <thead className={TABLE_HEAD_CLASS}>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider">
                      <th scope="col" className="px-5 py-3">Employee</th>
                      <th scope="col" className="px-5 py-3">Your Part</th>
                      <th scope="col" className="px-5 py-3">Evaluation Period</th>
                      <th scope="col" className="px-5 py-3">Due Date</th>
                      <th scope="col" className="px-5 py-3">Status</th>
                      <th scope="col" className="px-5 py-3">Result</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {filteredMyAssignments.map((assignment) => {
                      // A submitted head evaluation still needs its discussion recorded.
                      const discussionDue =
                        assignment.raterType === 'HEAD' && assignment.evaluatorId === myEmployeeId &&
                        assignment.status === 'SUBMITTED' && !assignment.discussionCompletedAt;
                      const statusMeta =
                        ASSIGNMENT_STATUS_META[assignment.status] || ASSIGNMENT_STATUS_META.NOT_STARTED;
                      const result = formatEvaluationResult(assignment);
                      const employeeName =
                        `${assignment.employee?.firstName ?? ''} ${assignment.employee?.lastName ?? ''}`.trim() ||
                        'Employee';
                      return (
                        <tr key={assignment.id} className="transition-colors hover:bg-surface-2/60">
                          <td className="px-5 py-4 align-top">
                            <p className="font-semibold text-foreground leading-snug">{employeeName}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {assignment.employee?.employeeNumber || '—'} ·{' '}
                              {assignment.employee?.jobRole?.title || 'No Role'}
                            </p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-xs font-medium text-foreground">
                              {assignment.evaluatorId === myEmployeeId
                                ? RATER_TYPE_LABEL[assignment.raterType ?? 'HEAD']
                                : 'Your evaluation result'}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-xs font-medium text-foreground">
                              {assignment.cycle?.name || 'Evaluation Period'}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(assignment.dueDate).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
                          </td>
                          <td className="px-5 py-4 align-top whitespace-nowrap">
                            {result.isDescriptive ? (
                              <StatusBadge
                                size="sm"
                                label={result.text}
                                className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                              />
                            ) : result.isScore ? (
                              <span className="inline-flex items-center rounded-lg border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-800 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
                                {result.text}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{result.text}</span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <Button
                              variant="update"
                              size="sm"
                              onClick={() => handleOpenEvaluationForm(assignment.id)}
                              className="gap-1.5 text-xs">
                              {assignment.status === 'NOT_STARTED' && (
                                <>
                                  <Play className="h-3.5 w-3.5" />
                                  Start Evaluation
                                </>
                              )}
                              {assignment.status === 'IN_PROGRESS' && (
                                <>
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Continue
                                </>
                              )}
                              {assignment.status === 'SUBMITTED' && (
                                <>
                                  <Eye className="h-3.5 w-3.5" />
                                  {discussionDue ? 'Record Discussion' : 'View Submitted'}
                                </>
                              )}
                              {assignment.status === 'FINALIZED' && (
                                <>
                                  <Eye className="h-3.5 w-3.5" />
                                  View Evaluation
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Evaluation Form / Assignment View (Interactive Workflow) ── */}
      <EvaluationFormModal
        open={evaluationModalOpen}
        onOpenChange={setEvaluationModalOpen}
        assignmentId={activeAssignmentId}
        onSuccess={() => {
          fetchData();
          if (selectedCycle) {
            handleOpenCycleDetail(selectedCycle);
          }
        }}
      />

      {/* ─── MODAL: Evaluators for one employee (HR) ──────────────────────────── */}
      {selectedCycle && (
        <EvaluationParticipantsDialog
          open={!!participantsEmployeeId}
          onOpenChange={(o) => !o && setParticipantsEmployeeId(null)}
          cycleId={selectedCycle.id}
          evaluationMode={selectedCycle.evaluationMode}
          subject={participantsSubject}
          onChanged={(cycle) => {
            setSelectedCycle(cycle);
            fetchData();
          }}
        />
      )}

      {/* ─── MODAL: Create Cycle ──────────────────────────────────────────────── */}
      <EvaluationCycleModal
        open={cycleModalOpen}
        onOpenChange={setCycleModalOpen}
        templates={templates}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* ─── MODAL: Template Form (Create / Edit) ─────────────────────────────── */}
      <EvaluationTemplateModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        templateToEdit={templateToEdit}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* ─── MODAL: View Template (official: view / duplicate; custom: also edit) ─ */}
      <EvaluationTemplateViewer
        template={selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        onChanged={fetchData}
        onEdit={(t) => {
          setSelectedTemplate(null);
          handleEditTemplate(t);
        }}
        onDuplicated={(copy) => {
          setSelectedTemplate(null);
          setTemplateToEdit(copy);
          setTemplateModalOpen(true);
        }}
      />

      {/* ─── MODAL: Deactivate Template Confirmation ─────────────────────────── */}
      <Dialog
        open={!!templateToDeactivate}
        onOpenChange={(open) => !open && setTemplateToDeactivate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger-dark">
              <PowerOff className="h-5 w-5 text-danger" />
              Deactivate Evaluation Template?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Are you sure you want to deactivate <strong className="text-foreground">{templateToDeactivate?.name}</strong>?
            </p>
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <p>• It will no longer be selectable for new evaluation cycles.</p>
              <p>• All past evaluation cycles and completed reviews remain safely preserved.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTemplateToDeactivate(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={deactivating}
              className="gap-1.5"
            >
              {deactivating ? 'Deactivating...' : 'Deactivate Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: Close Cycle Confirmation ─────────────────────────────────── */}
      <Dialog
        open={!!cycleToClose}
        onOpenChange={(open) => !open && setCycleToClose(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-warning-foreground">
              <Lock className="h-5 w-5" />
              Close Evaluation Cycle?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>
              Are you sure you want to close <strong className="text-foreground">{cycleToClose?.name}</strong>?
            </p>
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <p>• This marks the evaluation period complete and prevents further submissions.</p>
              <p>• All completed reviews and scoring history will remain permanently preserved.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCycleToClose(null)}
              disabled={closingCycle}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCloseCycle}
              disabled={closingCycle}
              className="gap-1.5"
            >
              {closingCycle ? 'Closing Cycle...' : 'Close Evaluation Cycle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: View Cycle Details (Enhanced with Assignments) ───────────── */}
      <Dialog open={!!selectedCycle} onOpenChange={(open) => !open && setSelectedCycle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-surface shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl font-heading font-bold text-foreground">
                <Calendar className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                {selectedCycle?.name}
              </DialogTitle>
              {selectedCycle?.status && (
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
                    CYCLE_STATUS_META[selectedCycle.status]?.badgeClass
                  )}
                >
                  {CYCLE_STATUS_META[selectedCycle.status]?.label}
                </span>
              )}
            </div>
            {selectedCycle?.description && (
              <p className="text-xs text-muted-foreground mt-1">{selectedCycle.description}</p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Meta Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block font-semibold">Form Template</span>
                <span className="font-bold text-foreground mt-0.5 block">{selectedCycle?.template?.name || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block font-semibold">Evaluation Period</span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {selectedCycle?.startDate ? new Date(selectedCycle.startDate).toLocaleDateString() : '—'} –{' '}
                  {selectedCycle?.dueDate ? new Date(selectedCycle.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-semibold">Evaluator Setup</span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {selectedCycle?.evaluatorAssignmentMethod
                    ? EVALUATOR_METHOD_LABELS[selectedCycle.evaluatorAssignmentMethod] || selectedCycle.evaluatorAssignmentMethod
                    : 'Immediate Supervisor'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-semibold">Default Evaluator</span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {selectedCycle?.defaultEvaluator
                    ? `${selectedCycle.defaultEvaluator.firstName} ${selectedCycle.defaultEvaluator.lastName}`
                    : 'None (Per Supervisor)'}
                </span>
              </div>
            </div>

            {/* Scopes Badge Summary */}
            <div>
              <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider mb-1.5">
                Target Organizational Scopes
              </span>
              {selectedCycle?.scopes && selectedCycle.scopes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCycle.scopes.map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs">
                      {s.scopeType === 'ALL' && 'All Active Employees'}
                      {s.scopeType === 'UNIT' && `Unit: ${s.targetUnit?.name || '—'}`}
                      {s.scopeType === 'DEPARTMENT' && `Department: ${s.targetDepartment?.name || '—'}`}
                      {s.scopeType === 'JOB_ROLE' && `Job Role: ${s.targetJobRole?.title || '—'}`}
                      {s.scopeType === 'EMPLOYEE' && `Staff: ${s.targetEmployee?.firstName || ''} ${s.targetEmployee?.lastName || ''}`.trim()}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">All Active Employees</span>
              )}
            </div>

            {/* Progress per employee evaluated (not per rater) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { label: 'Employees', value: selectedCycle?.metrics?.total ?? 0, cls: 'text-foreground' },
                { label: 'Not Started', value: selectedCycle?.metrics?.notStarted ?? 0, cls: 'text-slate-600 dark:text-slate-400' },
                { label: 'In Progress', value: selectedCycle?.metrics?.inProgress ?? 0, cls: 'text-status-info-foreground' },
                { label: 'Discussion / HR Pending', value: selectedCycle?.metrics?.submitted ?? 0, cls: 'text-status-warning-foreground' },
                { label: 'Finalized', value: selectedCycle?.metrics?.finalized ?? 0, cls: 'text-status-success-foreground' },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-xl bg-surface border border-border text-center">
                  <span className="text-[11px] text-muted-foreground font-semibold block">{m.label}</span>
                  <span className={cn('text-lg font-bold', m.cls)}>{m.value}</span>
                </div>
              ))}
            </div>
            {selectedCycle?.metrics && (
              <p className="text-xs text-muted-foreground">
                {selectedCycle.evaluationMode === 'WEIGHTED_MULTI_RATER' && (
                  <>
                    Self ratings: <strong className="text-foreground">{selectedCycle.metrics.selfSubmitted ?? 0} of {selectedCycle.metrics.selfTotal ?? 0}</strong> completed ·
                    Peer evaluations: <strong className="text-foreground">{selectedCycle.metrics.peerSubmitted ?? 0} of {selectedCycle.metrics.peerTotal ?? 0}</strong> completed ·{' '}
                  </>
                )}
                Discussions pending: <strong className="text-foreground">{selectedCycle.metrics.discussionPending ?? 0}</strong> ·
                Head evaluator not assigned: <strong className="text-foreground">{selectedCycle.metrics.headUnassigned ?? 0}</strong>
              </p>
            )}

            {/* Workflow per employee */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
                  Employees in this cycle ({selectedCycle?.subjects?.length || 0})
                </h4>
                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter employees..."
                      value={cycleDetailAssignmentSearch}
                      onChange={(e) => setCycleDetailAssignmentSearch(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>
                  <select
                    aria-label="Filter by stage"
                    value={cycleDetailAssignmentStatusFilter}
                    onChange={(e) => setCycleDetailAssignmentStatusFilter(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary-500 h-8"
                  >
                    <option value="ALL">All Stages</option>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DISCUSSION_PENDING">Discussion Pending</option>
                    <option value="READY_TO_FINALIZE">Ready for HR</option>
                    <option value="FINALIZED">Finalized</option>
                  </select>
                </div>
              </div>
              {isFullHR && selectedCycle && !loadingCycleDetail && (
                <CycleModeCard cycle={selectedCycle} />
              )}
              <p className="text-[11px] text-muted-foreground">
                {selectedCycle?.evaluationMode === 'WEIGHTED_MULTI_RATER'
                  ? 'Self rating → peer evaluations → head / supervisor / coordinator evaluation → discussion with the employee → HR finalization.'
                  : 'Head / supervisor / coordinator evaluation → discussion with the employee → HR finalization.'}{' '}
                HR manages who evaluates; HR does not enter ratings.
              </p>

              {loadingCycleDetail ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary-500" />
                  Loading cycle progress...
                </div>
              ) : filteredCycleSubjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  No employees match the selected filter.
                </div>
              ) : (
                <CycleWorkflowTable
                  subjects={filteredCycleSubjects}
                  weighted={selectedCycle?.evaluationMode === 'WEIGHTED_MULTI_RATER'}
                  cycleActive={selectedCycle?.status === 'ACTIVE'}
                  onOpenAssignment={handleOpenEvaluationForm}
                  onManageParticipants={(s) => setParticipantsEmployeeId(s.employeeId)}
                />
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-surface shrink-0 flex items-center justify-between">
            {isFullHR && selectedCycle?.status === 'ACTIVE' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCloseCycle(selectedCycle)}
                className="gap-1.5 text-danger hover:bg-danger-light border-danger/30"
              >
                <Lock className="h-3.5 w-3.5" />
                Close Cycle
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedCycle(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
