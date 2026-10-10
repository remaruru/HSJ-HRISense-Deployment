import { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Building,
  MapPin,
  ShieldCheck,
  Award,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  TrainingService,
  EmployeeTrainingHistoryItem,
  TRAINING_TYPE_LABELS,
  PARTICIPATION_STATUS_META,
} from '@/services/training.service';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error-handler.util';

interface EmployeeTrainingProfileTabProps {
  employeeId: string;
}

export function EmployeeTrainingProfileTab({ employeeId }: EmployeeTrainingProfileTabProps) {
  const [history, setHistory] = useState<EmployeeTrainingHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await TrainingService.listEmployeeTrainingHistory(employeeId);
      setHistory(data);
    } catch (err: any) {
      const msg =
        getApiErrorStatus(err) === 403
          ? 'You do not have permission to view training records for this employee.'
          : getApiErrorMessage(err, 'Failed to load employee training history.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = async (item: EmployeeTrainingHistoryItem) => {
    try {
      await TrainingService.downloadCertificate(
        item.activityId,
        employeeId,
        item.certificateOriginalFilename || `${item.title}_Certificate.pdf`
      );
      toast.success('Certificate downloaded successfully.');
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to download certificate.');
      toast.error(msg);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [employeeId]);

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3 bg-surface rounded-2xl border border-border">
        <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Loading training history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-3 bg-surface rounded-2xl border border-border">
        <AlertCircle className="h-8 w-8 text-danger mx-auto" />
        <p className="text-xs font-semibold text-danger-dark">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchHistory} className="text-xs">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Tab Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-100 dark:border-primary-900">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold font-heading text-foreground">
              Training & Seminars History
            </h2>
            <p className="text-xs text-muted-foreground">
              Employee participation in organization-wide programs, seminars, and compliance training.
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-xs font-semibold bg-primary-50 text-primary-800 border-primary-200 dark:bg-primary-950/60 dark:text-primary-200 dark:border-primary-900"
        >
          {history.length} Record{history.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {/* ── Records Table ── */}
      <div className="border border-border rounded-2xl bg-surface overflow-hidden shadow-xs">
        {history.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground flex items-center justify-center mx-auto">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-semibold text-sm text-foreground">No training records yet</h3>
              <p className="text-xs text-muted-foreground">
                Training and seminar participation for this employee will appear here once assigned or completed.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-3.5">Training / Seminar</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Schedule</th>
                  <th className="px-5 py-3.5">Provider / Venue</th>
                  <th className="px-5 py-3.5">Participation Status</th>
                  <th className="px-5 py-3.5">Completed Date</th>
                  <th className="px-5 py-3.5">Compliance Fulfillment</th>
                  <th className="px-5 py-3.5">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item) => {
                  const statusMeta = PARTICIPATION_STATUS_META[item.participationStatus];
                  return (
                    <tr
                      key={item.participantId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground text-sm">{item.title}</div>
                        {item.hoursCredit && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {item.hoursCredit} Hours Credit
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium"
                        >
                          {TRAINING_TYPE_LABELS[item.type]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {new Date(item.startDate).toLocaleDateString()}
                          {item.startDate !== item.endDate && ` – ${new Date(item.endDate).toLocaleDateString()}`}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">{item.provider}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {item.venue}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn('text-xs font-semibold border', statusMeta.badgeClass)}
                        >
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                        {item.completedAt ? (
                          <div>
                            <span className="font-medium text-foreground">
                              {new Date(item.completedAt).toLocaleDateString()}
                            </span>
                            {item.validUntil && (
                              <div className="text-[11px] text-muted-foreground">
                                Valid until: {new Date(item.validUntil).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {item.complianceRecord ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-status-success-surface text-status-success-foreground border-status-success-border flex items-center gap-1 w-fit"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {item.complianceRequirement?.title || 'Fulfilled'}
                          </Badge>
                        ) : item.complianceRequirement ? (
                          <span className="text-[11px] text-status-warning-foreground">
                            Required: {item.complianceRequirement.title}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {item.certificateOriginalFilename ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadCertificate(item)}
                            className="text-xs h-7 gap-1.5"
                          >
                            <Award className="h-3.5 w-3.5 text-primary" />
                            <span>Download Certificate</span>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
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
  );
}
