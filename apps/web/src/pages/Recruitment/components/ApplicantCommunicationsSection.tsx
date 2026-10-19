import { confirmAction } from "@/components/shared/ConfirmProvider";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, AlertCircle, Eye, RefreshCcw } from "lucide-react";
import { RecruitmentService } from "@/services/recruitment.service";
import { CommunicationComposerDialog } from "./CommunicationComposerDialog";
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { toast } from "sonner";
import { LoadError } from "@/components/shared/LoadError";

interface ApplicantCommunicationsSectionProps {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  canSendEmail: boolean;
}

const statusColor: Record<string, string> = {
  SIMULATED: "bg-status-info-surface text-status-info-foreground",
  SENT: "bg-status-success-surface text-status-success-foreground",
  FAILED: "bg-status-danger-surface text-status-danger-foreground",
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-surface-2 dark:text-foreground",
  SENDING: "bg-status-warning-surface text-status-warning-foreground",
};

export function ApplicantCommunicationsSection({
  applicationId,
  applicantEmail,
  applicantName,
  canSendEmail,
}: ApplicantCommunicationsSectionProps) {
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [devEmailMode, setDevEmailMode] = useState(false);

  const fetchCommunications = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await RecruitmentService.listCommunications(applicationId);
      setCommunications(response.items);
      setDevEmailMode(response.devEmailMode);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "The email history could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications();
  }, [applicationId]);

  const handleRetry = async (communicationId: string) => {
    if (!(await confirmAction({ title: "Send this email again?", message: "It failed the last time it was sent.", confirmLabel: "Retry sending" }))) return;
    
    setRetryingId(communicationId);
    try {
      await RecruitmentService.retryCommunication(applicationId, communicationId);
      await fetchCommunications();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to retry email."));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="bg-surface dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Mail className="w-5 h-5" /> Email Communications
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCommunications} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canSendEmail && (
            <Button size="sm" onClick={() => setIsComposerOpen(true)}>
              Compose Email
            </Button>
          )}
        </div>
      </div>
      
      {devEmailMode && (
        <div className="bg-status-warning-surface border-b border-status-warning-border px-4 py-3 flex items-start gap-3 text-status-warning-foreground text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-status-warning-foreground mt-0.5" />
          <p>
            <strong>Development email mode is active.</strong> Messages are simulated and will not be delivered to applicants.
          </p>
        </div>
      )}

      <div className="p-4">
        {loading && communications.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-muted-foreground">Loading communications...</div>
        ) : loadError ? (
          <LoadError compact message={loadError} onRetry={fetchCommunications} />
        ) : communications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 flex flex-col items-center dark:text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-20" />
            <p>No emails have been sent to this applicant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {communications.map((comm) => (
              <div key={comm.id} className="border dark:border-gray-700 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      {comm.subjectSnapshot}
                      <Badge className={statusColor[comm.sendStatus] || "bg-gray-100 dark:bg-surface-2"}>
                        {comm.sendStatus === 'SIMULATED' ? 'SIMULATED — No external email was sent' : comm.sendStatus}
                      </Badge>
                      {comm.sendStatus === 'SENDING' && (new Date().getTime() - new Date(comm.createdAt).getTime() > 5 * 60000) && (
                        <Badge className="bg-status-warning-surface text-status-warning-foreground border-status-warning-border">
                          <AlertCircle className="w-3 h-3 mr-1 inline" /> Stale (Requires Review)
                        </Badge>
                      )}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {comm.retryOfCommunicationId ? (
                        <Badge variant="outline" className="text-xs bg-status-accent-surface text-status-accent-foreground border-status-accent-border">
                          MANUAL RETRY OF AUTOMATIC EMAIL
                        </Badge>
                      ) : comm.source === 'AUTOMATIC_SYSTEM' ? (
                        <Badge variant="outline" className="text-xs bg-status-info-surface text-status-info-foreground border-status-info-border">
                          AUTOMATIC SYSTEM EMAIL
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft">
                          MANUAL HR EMAIL
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 dark:text-muted-foreground">
                      Type: {comm.communicationType.replace(/_/g, ' ')} | To: {comm.recipientEmail} {comm.triggerType ? `| Trigger: ${comm.triggerType}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-muted-foreground">
                    <span>
                      {new Date(comm.createdAt).toLocaleString("en-PH", {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                
                {comm.failureReason && comm.sendStatus === 'FAILED' && (
                  <div className="mt-2 text-xs text-status-danger-foreground bg-status-danger-surface p-2 rounded flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {comm.failureReason}
                    </span>
                    {canSendEmail && !comm.retryOfCommunicationId && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs bg-surface"
                        onClick={() => handleRetry(comm.id)}
                        disabled={retryingId === comm.id}
                      >
                        <RefreshCcw className={`w-3 h-3 ${retryingId === comm.id ? 'animate-spin' : ''}`} />
                        Retry
                      </Button>
                    )}
                  </div>
                )}
                
                <details className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  <summary className="cursor-pointer text-xs font-medium text-status-info-foreground hover:text-status-info-foreground outline-none">
                    View Message Body
                  </summary>
                  <div className="mt-2 p-3 bg-surface dark:bg-gray-800 border dark:border-gray-700 rounded font-mono text-xs whitespace-pre-wrap">
                    {comm.bodySnapshot}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      {isComposerOpen && (
        <CommunicationComposerDialog
          applicationId={applicationId}
          applicantEmail={applicantEmail}
          applicantName={applicantName}
          onClose={() => setIsComposerOpen(false)}
          onSuccess={() => {
            setIsComposerOpen(false);
            fetchCommunications();
          }}
        />
      )}
    </div>
  );
}
