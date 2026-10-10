import { useState, useEffect } from "react";
import {
  Brain,
  Plus,
  Calendar,
  FileText,
  Download,
  Shield,
  Lock,
  CheckCircle,
  Clock,
  AlertTriangle,
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
import { PsychologicalService, PsychologicalRecord } from "@/services/psychological.service";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from '@/utils/error-handler.util';

const ASSESSMENT_TYPES = [
  "PRE_EMPLOYMENT_PSYCH",
  "ANNUAL_PSYCHOLOGICAL_EVALUATION",
  "COUNSELING_SESSION",
  "FITNESS_FOR_DUTY_PSYCH",
  "FOLLOW_UP_SESSION",
  "OTHER",
];

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  ACCEPTED: {
    label: "Accepted",
    class: "bg-status-success-surface text-status-success-foreground border-status-success-border",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    class: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    class: "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
  },
};

/** `selfView`: My Profile — the person's own records, without HR's recording controls. */
export function EmployeePsychologicalProfileTab({ employeeId, selfView = false }: { employeeId: string; selfView?: boolean }) {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === "FULL" && !selfView;

  const [records, setRecords] = useState<PsychologicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formType, setFormType] = useState("ANNUAL_PSYCHOLOGICAL_EVALUATION");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formConductedBy, setFormConductedBy] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formHrNotes, setFormHrNotes] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await PsychologicalService.listRecords(employeeId);
      setRecords(data);
    } catch (err) {
      console.error("Failed to load psychological records", err);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [employeeId]);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await PsychologicalService.createRecord({
        employeeId,
        assessmentType: formType,
        assessmentDate: formDate,
        conductedBy: formConductedBy.trim() || undefined,
        employeeVisibleSummary: formSummary.trim() || undefined,
        hrConfidentialNotes: formHrNotes.trim() || undefined,
        expiresAt: formExpiresAt || undefined,
      });

      toast.success("Psychological assessment record added");
      setIsCreateOpen(false);
      setFormConductedBy("");
      setFormSummary("");
      setFormHrNotes("");
      setFormExpiresAt("");
      fetchRecords();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to create record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading psychological records...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-heading flex items-center gap-2">
            <Brain className="h-5 w-5 text-status-accent-foreground" />
            Psychological & Wellness Evaluations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-employment psych testing, annual wellness evaluations, and counseling records.
          </p>
        </div>

        {isFullHR && (
          <Button variant="create"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Psych Record
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
          No psychological assessment records found for this employee.
        </div>
      ) : (
        <div className="divide-y divide-border border rounded-xl overflow-hidden bg-surface">
          {records.map((rec) => {
            const stBadge = STATUS_BADGES[rec.reviewStatus] || STATUS_BADGES.PENDING_REVIEW;
            return (
              <div key={rec.id} className="p-4 space-y-3 hover:bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {rec.assessmentType.replace(/_/g, " ")}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold border", stBadge.class)}>
                        {stBadge.label}
                      </span>
                      {rec.expiresAt && (
                        <span className="px-2 py-0.5 rounded text-xs bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
                          Expires: {new Date(rec.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>Date: {new Date(rec.assessmentDate).toLocaleDateString()}</span>
                      {rec.conductedBy && <span>Evaluator: {rec.conductedBy}</span>}
                    </div>
                  </div>
                </div>

                {/* Employee-visible Summary */}
                {rec.employeeVisibleSummary && (
                  <div className="p-2.5 rounded-lg bg-status-accent-surface/50 border border-status-accent-border text-xs">
                    <span className="font-bold text-status-accent-foreground block mb-0.5 flex items-center gap-1">
                      <Brain className="h-3 w-3" /> Summary & Recommendations
                    </span>
                    <p className="text-status-accent-foreground">{rec.employeeVisibleSummary}</p>
                  </div>
                )}

                {/* HR Confidential Notes (Only rendered if present in payload) */}
                {rec.hrConfidentialNotes && (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-status-danger-foreground" /> HR Confidential Notes (Restricted)
                    </span>
                    <p className="text-slate-700 dark:text-slate-300">{rec.hrConfidentialNotes}</p>
                  </div>
                )}

                {/* Documents */}
                {rec.documents && rec.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {rec.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted text-xs font-medium"
                      >
                        <FileText className="h-3 w-3 text-status-accent-foreground" />
                        <span className="truncate max-w-[150px]">{doc.originalFilename}</span>
                        {doc.visibility === "HR_ONLY" && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Lock className="h-2.5 w-2.5" /> HR Only
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => PsychologicalService.downloadDocument(doc.id, doc.originalFilename)}
                          title="Download document"
                          className="text-status-accent-foreground hover:text-status-accent-foreground ml-1"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Create Psych Record ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-xl">
              Add Psychological Assessment Record
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRecord} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Assessment Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Assessment Date *
                </label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Conducted By / Evaluator
                </label>
                <Input
                  placeholder="e.g. Dra. Clara Ramirez, RPsy"
                  value={formConductedBy}
                  onChange={(e) => setFormConductedBy(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Expires / Re-eval Date
                </label>
                <Input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Brain className="h-3.5 w-3.5 text-status-accent-foreground" /> Employee-Visible Summary (Safe to view)
              </label>
              <textarea
                placeholder="High-level result summary visible to the employee..."
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-status-danger-foreground" /> HR Confidential Notes (Strictly restricted)
              </label>
              <textarea
                placeholder="Detailed behavioral, clinical, or confidential notes..."
                value={formHrNotes}
                onChange={(e) => setFormHrNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px]"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-accent hover:bg-status-accent-foreground text-white"
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
