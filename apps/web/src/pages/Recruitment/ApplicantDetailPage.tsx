import React, { useState, useEffect } from "react";
import { HelpLink } from '@/components/common/HelpLink';
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, FileText, CheckCircle2, MessageSquare, Clock, User as UserIcon, Calendar, Mail, FileCheck2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitmentService } from "@/services/recruitment.service";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { ApplicantInterviewsSection } from "./components/ApplicantInterviewsSection";
import { ApplicantCommunicationsSection } from "./components/ApplicantCommunicationsSection";
import { ApplicantOnboardingSection } from "./components/ApplicantOnboardingSection";
import { ApplicantDocumentsTab } from "./components/ApplicantDocumentsTab";
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from "sonner";
import { LoadError } from "@/components/shared/LoadError";

const statusLabel: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  FOR_INTERVIEW: "For Interview",
  INTERVIEWED: "Interviewed",
  FOR_REQUIREMENTS: "For Requirements",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const formatDate = (dateStr?: string, includeTime = false) => {
  if (!dateStr) return "—";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Date(dateStr).toLocaleDateString("en-PH", options);
};

function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default function ApplicantDetailPage() {
  const { applicationId } = useParams({ strict: false }) as any;
  const { user } = useAuth();
  const { hasPermission, tier } = usePermission();
  const isFullHR = tier === "FULL" || hasPermission("recruitment", "manage");

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("overview");

  // Status Action State
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");

  // Notes State
  const [noteContent, setNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchApplication = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await RecruitmentService.getApplicationById(applicationId);
      setApplication(data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load application details."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [applicationId]);

  const handleStatusChange = async () => {
    if (!targetStatus) return;
    setStatusUpdating(true);
    try {
      await RecruitmentService.changeApplicationStatus(applicationId, targetStatus, statusReason || undefined);
      setTargetStatus("");
      setStatusReason("");
      toast.success("Application status updated.");
      fetchApplication();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update status."));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteSubmitting(true);
    try {
      await RecruitmentService.addApplicantNote(applicationId, noteContent);
      setNoteContent("");
      fetchApplication();
    } catch (err: any) {
      // The note text stays in the box, so nothing has to be retyped.
      toast.error(getApiErrorMessage(err, "Failed to add note."));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (application?.referenceNumber) {
      navigator.clipboard.writeText(application.referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Loading application details...</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto text-center">
        {error ? (
          <LoadError message={error} onRetry={fetchApplication} className="max-w-xl mx-auto" />
        ) : (
          <p className="text-muted-foreground text-lg">Application not found</p>
        )}
        <Link to="/recruitment/applicants" className="text-primary hover:underline mt-4 inline-block">
          Return to Applicants
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <ClipboardList className="w-4 h-4" /> },
    { id: "documents", label: "Documents", icon: <FileText className="w-4 h-4" /> },
    { id: "interviews", label: "Interviews", icon: <Calendar className="w-4 h-4" /> },
    { id: "communications", label: "Communications", icon: <Mail className="w-4 h-4" /> },
    { id: "history", label: "Notes & History", icon: <Clock className="w-4 h-4" /> },
    { id: "onboarding", label: "Hiring & Onboarding", icon: <FileCheck2 className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-surface p-4 sm:p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/recruitment/applicants">
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {application.applicant.firstName} {application.applicant.lastName}
              </h1>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                {statusLabel[application.status] || application.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-2 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors" onClick={handleCopyRef}>
                Ref: <span className="font-mono">{application.referenceNumber}</span>
                {copied && <span className="text-primary text-xs ml-1 font-medium">Copied!</span>}
              </span>
              <span>&middot;</span>
              <span>Applied {formatDate(application.applicationDate)}</span>
              <span>&middot;</span>
              <span className="flex items-center gap-1">
                <BriefcaseIcon className="w-4 h-4 opacity-70" />
                {application.jobOpening.title}
              </span>
            </div>
            {(application.applicant.email || application.applicant.mobile) && (
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4 flex-wrap">
                {application.applicant.email && <span>{application.applicant.email}</span>}
                {application.applicant.mobile && (
                  <>
                    <span>&middot;</span>
                    <span>{application.applicant.mobile}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary Header Actions */}
        {isFullHR && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full xl:w-auto sm:items-center">
            <HelpLink slug="process-job-applicants" />
            <Button variant="update" 
              onClick={() => setActiveTab("onboarding")}>
              Update Status / Hire
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab("communications")}
            >
              Compose Email
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab("interviews")}
            >
              Schedule Interview
            </Button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 -mb-2 hide-scrollbar">
        <div className="flex space-x-1 bg-surface-2 p-1 rounded-lg border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="bg-surface rounded-xl border shadow-sm p-4 sm:p-6 min-h-[500px]">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2 flex items-center gap-2">
                  <BriefcaseIcon className="w-5 h-5 text-muted-foreground" />
                  Position Details
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground mb-1">Job Title</dt>
                    <dd className="font-medium text-foreground">{application.jobOpening.title}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Opening Ref</dt>
                    <dd className="font-mono text-foreground">{application.jobOpening.referenceNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Department</dt>
                    <dd className="text-foreground">{application.jobOpening.department?.name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Unit</dt>
                    <dd className="text-foreground">{application.jobOpening.unit?.name || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground mb-1">Applicant Message / Source</dt>
                    <dd className="text-foreground bg-surface-2 p-3 rounded-md border mt-1">
                      {application.applicantMessage || application.source || "None provided."}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                  Personal Information
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground mb-1">Full Name</dt>
                    <dd className="font-medium text-foreground">
                      {application.applicant.firstName} {application.applicant.middleName} {application.applicant.lastName} {application.applicant.suffix}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Email</dt>
                    <dd className="text-foreground">{application.applicant.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Mobile</dt>
                    <dd className="text-foreground">{application.applicant.mobile || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground mb-1">Present Address</dt>
                    <dd className="text-foreground">{application.applicant.address || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Sex</dt>
                    <dd className="text-foreground">
                      {application.applicant.gender
                        ? String(application.applicant.gender).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())
                        : <span className="text-muted-foreground">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">Religion</dt>
                    <dd className="text-foreground">{application.applicant.religion || <span className="text-muted-foreground">Not provided</span>}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <ApplicantDocumentsTab applicationId={applicationId} documents={application.documents} />
        )}

        {activeTab === "interviews" && (
          <ApplicantInterviewsSection
            applicationId={applicationId}
            interviews={application.interviews || []}
            onRefresh={fetchApplication}
            canScheduleInterview={isFullHR}
            canManageInterview={isFullHR}
          />
        )}

        {activeTab === "communications" && (
          <ApplicantCommunicationsSection
            applicationId={applicationId}
            applicantEmail={application.applicant.email}
            applicantName={`${application.applicant.firstName} ${application.applicant.lastName}`}
            canSendEmail={isFullHR}
          />
        )}

        {activeTab === "history" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Internal Notes */}
            <div className="flex flex-col h-[500px]">
              <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                Internal Notes
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                {application.notes?.length > 0 ? (
                  application.notes.map((note: any) => (
                    <div key={note.id} className="bg-surface-2 p-3 rounded-md text-sm border border-border">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-foreground text-xs">{note.createdByUser?.firstName} {note.createdByUser?.lastName}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(note.createdAt, true)}</span>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center pt-8">No internal notes yet.</p>
                )}
              </div>
              <form onSubmit={handleAddNote} className="mt-auto bg-surface-2 p-3 rounded-lg border border-border">
                <textarea
                  placeholder="Add a private note for HR..."
                  className="w-full text-sm bg-surface border-border rounded-md p-3 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <Button type="submit" disabled={!noteContent.trim() || noteSubmitting} size="sm">
                    {noteSubmitting ? "Saving..." : "Save Note"}
                  </Button>
                </div>
              </form>
            </div>

            {/* Status History */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Status History
              </h3>
              <div className="space-y-4 pl-4 border-l-2 border-border ml-2 mt-4">
                {application.statusHistory?.map((history: any) => (
                  <div key={history.id} className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-primary rounded-full -left-[1.45rem] top-1.5 border-2 border-surface"></div>
                    <div className="p-3 rounded-md bg-surface-2 border border-border text-sm">
                      <div className="font-medium text-foreground">
                        Changed to <span className="text-primary">{statusLabel[history.newStatus] || history.newStatus}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 mb-2">
                        <span>{formatDate(history.changedAt, true)}</span>
                        {history.changedByUser && (
                          <>
                            <span>&middot;</span>
                            <span>By {history.changedByUser.firstName} {history.changedByUser.lastName}</span>
                          </>
                        )}
                      </div>
                      {history.reason && (
                        <div className="text-foreground mt-2 bg-surface p-2 rounded border border-border text-xs">
                          {history.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "onboarding" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-muted-foreground" />
                Update Application Status
              </h3>
              <div className="bg-surface-2 p-5 rounded-lg border border-border space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">New Status</label>
                  <select 
                    className="w-full text-sm bg-surface border-border rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                  >
                    <option value="">Select status...</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="FOR_INTERVIEW">For Interview</option>
                    <option value="FOR_REQUIREMENTS">For Requirements</option>
                    <option value="HIRED">Hired (Final Action)</option>
                    <option value="REJECTED">Rejected (Final Action)</option>
                    <option value="WITHDRAWN">Withdrawn</option>
                  </select>
                </div>
                
                {targetStatus && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Reason / Note (Optional)</label>
                    <textarea
                      placeholder="Add an internal reason for this change..."
                      className="w-full text-sm bg-surface border-border rounded-md p-3 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                    />
                  </div>
                )}
                
                {targetStatus && (
                  <div className="bg-status-warning-surface border border-status-warning-border text-status-warning-foreground p-3 rounded-md text-sm mt-3">
                    <p className="font-semibold flex items-center gap-1"><Mail className="w-4 h-4" /> Automatic System Email</p>
                    <p className="mt-1">Changing this application status will automatically send an email to the applicant (<strong>{application?.applicant?.email}</strong>).</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button 
                    className="w-full" 
                    disabled={!targetStatus || statusUpdating}
                    onClick={handleStatusChange}
                  >
                    {statusUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Confirm Status Change
                  </Button>
                  {(targetStatus === "HIRED" || targetStatus === "REJECTED" || targetStatus === "WITHDRAWN") && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Note: Marking as {statusLabel[targetStatus]} is a final action. It will send a final status email.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <ApplicantOnboardingSection
                applicationId={applicationId}
                application={application}
                canConvert={isFullHR}
                onRefresh={fetchApplication}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
