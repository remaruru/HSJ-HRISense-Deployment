import { RATER_TYPE_LABEL } from '@/services/evaluation.service';
import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  resolveRatingPreset,
  EvaluationService,
  EvaluationAssignment,
  EvaluationAssignmentStatus,
  formatEvaluationResult,
} from '@/services/evaluation.service';
import { EvaluationFormModal } from '@/pages/Evaluations/components/EvaluationFormModal';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error-handler.util';

interface EmployeeEvaluationProfileTabProps {
  employeeId: string;
  /** My Profile: the person's own evaluations, without HR's visibility controls. */
  selfView?: boolean;
}

const STATUS_META: Record<EvaluationAssignmentStatus, { label: string; badgeClass: string; icon: any }> = {
  NOT_STARTED: {
    label: 'Not Started',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
    icon: Sparkles,
  },
  SUBMITTED: {
    label: 'Awaiting Finalization',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
    icon: AlertCircle,
  },
  FINALIZED: {
    label: 'Completed',
    badgeClass: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
    icon: CheckCircle2,
  },
};

export function EmployeeEvaluationProfileTab({ employeeId, selfView = false }: EmployeeEvaluationProfileTabProps) {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === 'FULL' && !selfView;
  const isSelf = user?.employee?.id === employeeId;

  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<EvaluationAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Read-only Evaluation Detail Dialog State
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  const fetchHistory = async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await EvaluationService.listEmployeeHistory(employeeId);
      setHistory(data || []);
    } catch (err: any) {
      if (getApiErrorStatus(err) === 403) {
        setError('You do not have permission to view these evaluation records.');
      } else {
        setError(getApiErrorMessage(err, 'HRISense encountered a problem loading evaluation records. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [employeeId]);

  const handleOpenDetail = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setDetailModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            Performance Evaluation History
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSelf
              ? 'View your completed official performance evaluation appraisals.'
              : "View this employee's completed and authorized performance evaluation records."}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHistory}
          disabled={loading}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground bg-surface rounded-2xl border border-border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-500" />
          <p className="text-sm">Loading evaluation history...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-danger-light border border-danger/30 text-danger-dark text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Evaluation History Unavailable</span>
            <span>{error}</span>
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center bg-surface rounded-2xl border border-border">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h4 className="font-bold text-foreground mb-1">No evaluation records yet</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Completed evaluation records for this employee will appear here once finalized.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Evaluation</th>
                  <th className="px-5 py-3.5">Period</th>
                  <th className="px-5 py-3.5">Evaluator</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Result</th>
                  <th className="px-5 py-3.5">Finalized Date</th>
                  {isFullHR && <th className="px-5 py-3.5">Employee Visibility</th>}
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((assignment) => {
                  const statusMeta = STATUS_META[assignment.status] || STATUS_META.NOT_STARTED;
                  const StatusIcon = statusMeta.icon;
                  const isDescriptive = resolveRatingPreset(assignment.template ?? {}).id === 'DESCRIPTIVE';

                  return (
                    <tr key={assignment.id} className="hover:bg-muted/30 transition-colors">
                      {/* Evaluation Name / Cycle */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-foreground">
                          {assignment.cycle?.name || 'Evaluation Period'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {assignment.template?.name || 'Standard Review'}
                        </p>
                        {/* HR sees every component; the employee's record is the head evaluation. */}
                        <p className="text-[11px] font-semibold text-foreground mt-0.5">
                          {RATER_TYPE_LABEL[assignment.raterType ?? 'HEAD']}
                        </p>
                      </td>

                      {/* Evaluation Period */}
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {assignment.cycle?.startDate ? (
                          <span>
                            {new Date(assignment.cycle.startDate).toLocaleDateString()} –{' '}
                            {new Date(assignment.cycle.dueDate || assignment.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
                        )}
                      </td>

                      {/* Evaluator */}
                      <td className="px-5 py-4">
                        {assignment.evaluator ? (
                          <div>
                            <span className="font-medium text-foreground block">
                              {assignment.evaluator.firstName} {assignment.evaluator.lastName}
                            </span>
                            {assignment.evaluator.employeeNumber && (
                              <span className="text-[11px] text-muted-foreground block">
                                {assignment.evaluator.employeeNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                            statusMeta.badgeClass
                          )}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusMeta.label}
                        </span>
                      </td>

                      {/* Result */}
                      <td className="px-5 py-4 font-semibold text-foreground whitespace-nowrap">
                        {(() => {
                          const res = formatEvaluationResult(assignment);
                          if (res.isDescriptive) {
                            return (
                              <Badge variant="outline" className="text-xs font-medium bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-border-soft">
                                {res.text}
                              </Badge>
                            );
                          }
                          if (res.isScore) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-primary-50 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200 font-bold text-xs border border-primary-200 dark:border-primary-800">
                                {res.text}
                              </span>
                            );
                          }
                          return <span className="text-xs text-muted-foreground">{res.text}</span>;
                        })()}
                      </td>

                      {/* Finalized Date */}
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {assignment.finalizedAt ? (
                          new Date(assignment.finalizedAt).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Visibility (HR only) */}
                      {isFullHR && (
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px] font-semibold',
                              assignment.isEmployeeVisible
                                ? 'bg-status-success-surface text-status-success-foreground border-status-success-border'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-border-soft'
                            )}
                          >
                            {assignment.isEmployeeVisible ? 'Visible to Employee' : 'Hidden from Employee'}
                          </Badge>
                        </td>
                      )}

                      {/* Action */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Button
                          variant="review"
                          size="sm"
                          onClick={() => handleOpenDetail(assignment.id)}
                          className="text-xs gap-1.5 h-8">
                          <Eye className="h-3.5 w-3.5" />
                          View Evaluation
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Read-only Evaluation Detail Dialog */}
      <EvaluationFormModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        assignmentId={selectedAssignmentId}
        readOnlyForce={true}
        onSuccess={fetchHistory}
      />
    </div>
  );
}
