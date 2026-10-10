import { useState, useEffect } from "react";
import {
  Stethoscope,
  Plus,
  Calendar,
  FileText,
  Download,
  Shield,
  UploadCloud,
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
import { MedicalService, MedicalRecord } from "@/services/medical.service";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from '@/utils/error-handler.util';

const EXAM_TYPES = [
  "PRE_EMPLOYMENT",
  "ANNUAL_PHYSICAL",
  "FIT_TO_WORK",
  "IMMUNIZATION",
  "OCCUPATIONAL_HEALTH",
  "INCIDENT_ASSESSMENT",
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
export function EmployeeMedicalProfileTab({ employeeId, selfView = false }: { employeeId: string; selfView?: boolean }) {
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === "FULL" && !selfView;

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formExamType, setFormExamType] = useState("ANNUAL_PHYSICAL");
  const [formExamDate, setFormExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [formExaminedBy, setFormExaminedBy] = useState("");
  const [formHrNotes, setFormHrNotes] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await MedicalService.listRecords(employeeId);
      setRecords(data);
    } catch (err) {
      console.error("Failed to load medical records", err);
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
      await MedicalService.createRecord({
        employeeId,
        examType: formExamType,
        examDate: formExamDate,
        examinedBy: formExaminedBy.trim() || undefined,
        hrNotes: formHrNotes.trim() || undefined,
        expiresAt: formExpiresAt || undefined,
      });

      toast.success("Medical record added");
      setIsCreateOpen(false);
      setFormExaminedBy("");
      setFormHrNotes("");
      setFormExpiresAt("");
      fetchRecords();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to add record"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading medical records...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-heading flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary-600 dark:text-primary-300" />
            Medical History & Clearances
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical examinations, immunizations, and clinical fitness clearances.
          </p>
        </div>

        {isFullHR && (
          <Button variant="create"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Medical Record
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
          No medical records found for this employee.
        </div>
      ) : (
        <div className="divide-y divide-border border rounded-xl overflow-hidden bg-surface">
          {records.map((rec) => {
            const stBadge = STATUS_BADGES[rec.reviewStatus] || STATUS_BADGES.PENDING_REVIEW;
            return (
              <div key={rec.id} className="p-4 space-y-2 hover:bg-muted/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {rec.examType.replace(/_/g, " ")}
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
                      <span>Exam Date: {new Date(rec.examDate).toLocaleDateString()}</span>
                      {rec.examinedBy && <span>Facility: {rec.examinedBy}</span>}
                    </div>
                  </div>
                </div>

                {/* HR Confidential Notes (Only rendered if present in payload) */}
                {rec.hrNotes && (
                  <div className="p-2.5 rounded-lg bg-status-warning-surface/50 border border-status-warning-border text-xs">
                    <span className="font-bold text-status-warning-foreground block mb-0.5 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> HR Notes (Confidential)
                    </span>
                    <p className="text-status-warning-foreground">{rec.hrNotes}</p>
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
                        <FileText className="h-3 w-3 text-primary-600 dark:text-primary-300" />
                        <span className="truncate max-w-[150px]">{doc.originalFilename}</span>
                        <button
                          type="button"
                          onClick={() => MedicalService.downloadDocument(doc.id, doc.originalFilename)}
                          title="Download document"
                          className="text-primary-600 hover:text-primary-700 ml-1 dark:text-primary-300 dark:hover:text-primary-300"
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

      {/* ── Dialog: Create Medical Record ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-black text-xl">
              Add Medical Record
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRecord} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Exam Type *
                </label>
                <select
                  value={formExamType}
                  onChange={(e) => setFormExamType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Exam Date *
                </label>
                <Input
                  type="date"
                  value={formExamDate}
                  onChange={(e) => setFormExamDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Examined By / Clinic Name
              </label>
              <Input
                placeholder="e.g. Dr. Maria Santos / Hospicio Health Clinic"
                value={formExaminedBy}
                onChange={(e) => setFormExaminedBy(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Expires At (if annual clearance)
              </label>
              <Input
                type="date"
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-primary-600 dark:text-primary-300" /> HR Clinical Notes (Confidential)
              </label>
              <textarea
                placeholder="Diagnostic remarks, clearance restrictions (never shown to employee)..."
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
