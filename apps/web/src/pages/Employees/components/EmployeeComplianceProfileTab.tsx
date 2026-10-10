import { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ComplianceService,
  EmployeeComplianceSummaryItem,
  EmployeeComplianceRecord,
} from "@/services/compliance.service";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { LoadError } from "@/components/shared/LoadError";

const STATUS_BADGES: Record<string, { label: string; class: string; icon: any }> = {
  VALID: {
    label: "Compliant",
    class: "bg-status-success-surface text-status-success-foreground border-status-success-border",
    icon: CheckCircle,
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    class: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
    icon: Clock,
  },
  EXPIRED: {
    label: "Expired",
    class: "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
    icon: AlertTriangle,
  },
  MISSING: {
    label: "Missing",
    class: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
    icon: XCircle,
  },
  NEEDS_REVIEW: {
    label: "Needs Review",
    class: "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
    icon: RefreshCw,
  },
};

/** `selfView`: My Profile — the person's own compliance, without HR's recording controls. */
export function EmployeeComplianceProfileTab({ employeeId, selfView = false }: { employeeId: string; selfView?: boolean }) {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === "FULL" && !selfView;

  const [summary, setSummary] = useState<EmployeeComplianceSummaryItem[]>([]);
  const [records, setRecords] = useState<EmployeeComplianceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // Fulfillment Dialog
  const [isFulfillOpen, setIsFulfillOpen] = useState(false);
  const [fulfillReqId, setFulfillReqId] = useState("");
  const [fulfillTitle, setFulfillTitle] = useState("");
  const [fulfillRef, setFulfillRef] = useState("");
  const [fulfillCompletedAt, setFulfillCompletedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fulfillExpiresAt, setFulfillExpiresAt] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    setRecordsError(null);
    try {
      const [sumData, recData] = await Promise.all([
        ComplianceService.getEmployeeSummary(employeeId),
        // The history is secondary: if only it fails, the requirements still
        // show and the history says it could not be loaded.
        ComplianceService.listEmployeeRecords(employeeId).catch((recErr) => {
          setRecordsError(getApiErrorMessage(recErr, "The fulfillment history could not be loaded."));
          return [];
        }),
      ]);
      setSummary(sumData);
      setRecords(recData);
      if (sumData.length > 0 && !fulfillReqId) {
        setFulfillReqId(sumData[0].requirement.id);
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "This employee's compliance profile could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const handleRecordFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillReqId || !fulfillTitle.trim()) {
      return toast.error("Please fill all required fields");
    }

    setIsSubmitting(true);
    try {
      await ComplianceService.createEmployeeRecord({
        employeeId,
        requirementId: fulfillReqId,
        recordTitle: fulfillTitle.trim(),
        referenceNumber: fulfillRef.trim() || undefined,
        completedAt: fulfillCompletedAt,
        expiresAt: fulfillExpiresAt || undefined,
        notes: fulfillNotes.trim() || undefined,
      });

      toast.success("Fulfillment record created");
      setIsFulfillOpen(false);
      setFulfillTitle("");
      setFulfillRef("");
      setFulfillExpiresAt("");
      setFulfillNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to create record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading compliance profile...</div>;
  }

  if (loadError) {
    return <LoadError message={loadError} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-heading flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            Compliance Status & Requirements
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applicable mandatory regulatory, licensing, and operational requirements.
          </p>
        </div>

        {isFullHR && (
          <Button
            size="sm"
            onClick={() => setIsFulfillOpen(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Fulfillment
          </Button>
        )}
      </div>

      {/* Requirement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {summary.map((item) => {
          const badge = STATUS_BADGES[item.status] || STATUS_BADGES.MISSING;
          const Icon = badge.icon;
          return (
            <div
              key={item.requirement.id}
              className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-3 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground font-heading">
                    {item.requirement.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border">
                    {item.requirement.category}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {item.latestRecordDate && (
                    <p>Last Completed: {new Date(item.latestRecordDate).toLocaleDateString()}</p>
                  )}
                  {item.expiresAt && (
                    <p>Expires: {new Date(item.expiresAt).toLocaleDateString()}</p>
                  )}
                  {!item.latestRecordDate && <p className="italic text-status-warning-foreground">No completion on file</p>}
                </div>
              </div>

              <span
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1 shrink-0",
                  badge.class
                )}
              >
                <Icon className="h-3 w-3" />
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Fulfillment Records History */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Fulfillment History ({records.length})
        </h4>

        {recordsError ? (
          <LoadError compact message={recordsError} onRetry={fetchData} />
        ) : records.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
            No compliance fulfillment records logged yet.
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-xl overflow-hidden bg-surface">
            {records.map((rec) => (
              <div key={rec.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/20">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-foreground">{rec.recordTitle}</span>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>Req: {rec.requirement?.title}</span>
                    {rec.referenceNumber && <span>Ref: {rec.referenceNumber}</span>}
                    <span>Completed: {new Date(rec.completedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold border",
                    rec.reviewStatus === "ACCEPTED"
                      ? "bg-status-success-surface text-status-success-foreground border-status-success-border"
                      : rec.reviewStatus === "NEEDS_CORRECTION"
                      ? "bg-status-danger-surface text-status-danger-foreground border-status-danger-border"
                      : "bg-status-warning-surface text-status-warning-foreground border-status-warning-border"
                  )}
                >
                  {rec.reviewStatus.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog: Record Fulfillment ── */}
      <Dialog open={isFulfillOpen} onOpenChange={setIsFulfillOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-xl">
              Record Compliance Fulfillment
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordFulfillment} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Requirement *
              </label>
              <select
                value={fulfillReqId}
                onChange={(e) => setFulfillReqId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                required
              >
                {summary.map((s) => (
                  <option key={s.requirement.id} value={s.requirement.id}>
                    {s.requirement.title} ({s.requirement.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Record / Certificate Title *
              </label>
              <Input
                placeholder="e.g. Fire Safety Training Certificate 2026"
                value={fulfillTitle}
                onChange={(e) => setFulfillTitle(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Reference / License Number
              </label>
              <Input
                placeholder="e.g. CERT-2026-981"
                value={fulfillRef}
                onChange={(e) => setFulfillRef(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Date Completed *
                </label>
                <Input
                  type="date"
                  value={fulfillCompletedAt}
                  onChange={(e) => setFulfillCompletedAt(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Expires At (if applicable)
                </label>
                <Input
                  type="date"
                  value={fulfillExpiresAt}
                  onChange={(e) => setFulfillExpiresAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notes
              </label>
              <textarea
                placeholder="Optional verification notes..."
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFulfillOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
