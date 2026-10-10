import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Edit, Globe, XCircle, CheckCircle, Archive as ArchiveIcon, Briefcase, FileText, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RecruitmentService, JobOpening, JobOpeningStatus } from "@/services/recruitment.service";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from '@/utils/error-handler.util';

const statusColor: Record<JobOpeningStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft",
  OPEN: "bg-success-50 text-success-700 border-success-200",
  CLOSED: "bg-warning-light text-warning-dark border-warning",
  FILLED: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900",
  ARCHIVED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft",
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
};

export default function JobOpeningDetailPage() {
  const { openingId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { hasPermission, tier } = usePermission();
  
  const canManage = tier === "FULL" || hasPermission("recruitment", "manage");
  const canPublish = tier === "FULL" || hasPermission("recruitment", "publish");

  const [opening, setOpening] = useState<JobOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const fetchOpening = async () => {
    try {
      if (!openingId) return;
      const data = await RecruitmentService.getJobOpeningById(openingId);
      setOpening(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load job opening"));
      navigate({ to: "/recruitment/openings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpening();
  }, [openingId]);

  const handleStatusChange = async (newStatus: JobOpeningStatus, confirmMessage: string) => {
    if (!opening || !openingId) return;
    if (!window.confirm(confirmMessage)) return;

    setActionPending(true);
    try {
      await RecruitmentService.changeJobOpeningStatus(openingId, newStatus);
      toast.success(`Status changed to ${newStatus}`);
      await fetchOpening();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "An error occurred"));
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <p className="text-muted-foreground">Loading details...</p>
      </div>
    );
  }

  if (!opening) return null;

  return (
    <div className="p-6 h-full flex flex-col space-y-6 max-w-screen-xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/recruitment/openings" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{opening.title}</h1>
              <Badge variant="outline" className={statusColor[opening.status]}>
                {opening.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Reference: {opening.referenceNumber}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && opening.status !== "ARCHIVED" && (
            <Button variant="update" size="sm" onClick={() => navigate({ to: `/recruitment/openings/${openingId}/edit` })} disabled={actionPending} className="gap-2">
              <Edit className="h-4 w-4" /> Edit
            </Button>
          )}

          {canPublish && opening.status === "DRAFT" && (
            <Button variant="create" size="sm" onClick={() => handleStatusChange("OPEN", "Publish this opening? It will become publicly visible if dates are valid.")} disabled={actionPending} className="gap-2 border-transparent shadow-pop-color">
              <Globe className="h-4 w-4" /> Publish
            </Button>
          )}

          {canManage && opening.status === "OPEN" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleStatusChange("CLOSED", "Close this opening? It will no longer accept new applications.")} disabled={actionPending} className="gap-2 text-warning-dark hover:text-warning-dark hover:bg-warning-light border-warning-dark">
                <XCircle className="h-4 w-4" /> Close
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleStatusChange("FILLED", "Mark as filled? It will no longer receive applications.")} disabled={actionPending} className="gap-2 text-primary-700 hover:text-primary-700 hover:bg-primary-50 border-primary-500 dark:text-primary-300 dark:hover:text-primary-300 dark:hover:bg-primary-900/40">
                <CheckCircle className="h-4 w-4" /> Mark Filled
              </Button>
            </>
          )}

          {canManage && (opening.status === "CLOSED" || opening.status === "FILLED") && (
            <Button variant="delete" size="sm" onClick={() => handleStatusChange("ARCHIVED", "Archive this opening? It will be hidden from normal active lists.")} disabled={actionPending} className="gap-2">
              <ArchiveIcon className="h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border rounded-xl shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" /> Description
              </h2>
              <div className="text-sm text-foreground whitespace-pre-wrap">{opening.description}</div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" /> Responsibilities
              </h2>
              <div className="text-sm text-foreground whitespace-pre-wrap">{opening.responsibilities}</div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-muted-foreground" /> Qualifications
              </h2>
              <div className="text-sm text-foreground whitespace-pre-wrap">{opening.qualifications}</div>
            </div>

            {opening.requiredDocuments && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" /> Required Documents
                </h2>
                <div className="text-sm text-foreground whitespace-pre-wrap">{opening.requiredDocuments}</div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Job Details</h2>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Unit</div>
                <div className="text-sm font-medium text-foreground">{opening.unit?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Department</div>
                <div className="text-sm font-medium text-foreground">{opening.department?.name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Job Role</div>
                <div className="text-sm font-medium text-foreground">{opening.jobRole?.title || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Employment Type</div>
                <div className="text-sm font-medium text-foreground">{opening.employmentType.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Vacancies</div>
                <div className="text-sm font-medium text-foreground">{opening.vacancies || "Open"}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Opening Date</div>
                  <div className="text-sm font-medium text-foreground">{formatDate(opening.openingDate)}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Closing Date</div>
                  <div className="text-sm font-medium text-foreground">{formatDate(opening.closingDate)}</div>
                </div>
              </div>
              {opening.publishedAt && (
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Published</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(opening.publishedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" /> Applications
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{opening._count?.applications || 0}</div>
            </div>
            {/* View applicants button can go here in Phase 4 */}
          </div>
        </div>
      </div>
    </div>
  );
}
