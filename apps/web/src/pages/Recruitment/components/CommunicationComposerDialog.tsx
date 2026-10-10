import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RecruitmentService } from "@/services/recruitment.service";
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface CommunicationComposerDialogProps {
  applicationId: string;
  applicantEmail: string;
  applicantName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TEMPLATE_TYPES = [
  "APPLICATION_RECEIVED",
  "APPLICATION_UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW_INVITATION",
  "INTERVIEW_RESCHEDULED",
  "INTERVIEW_CANCELLED",
  "APPLICATION_ACCEPTED",
  "APPLICATION_NOT_SELECTED",
  "ADDITIONAL_REQUIREMENTS",
  "CUSTOM_MESSAGE"
];

export function CommunicationComposerDialog({
  applicationId,
  applicantEmail,
  applicantName,
  onClose,
  onSuccess
}: CommunicationComposerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [type, setType] = useState<string>("CUSTOM_MESSAGE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const loadPreview = async (selectedType: string) => {
    setPreviewing(true);
    setError(null);
    try {
      const previewData = await RecruitmentService.previewEmail(applicationId, selectedType, {
        applicantName,
        applicationReference: `APP-${applicationId.substring(0, 8).toUpperCase()}`,
        jobTitle: "the requested position", // Would ideally pull from job opening
        hrContactEmail: "hr@hospiciodesanjose.org"
      });
      setSubject(previewData.subject);
      setBody(previewData.textBody);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load template preview."));
      setSubject("");
      setBody("");
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    loadPreview(type);
  }, [type]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      await RecruitmentService.sendEmail(applicationId, type, {
        applicantName,
        applicationReference: `APP-${applicationId.substring(0, 8).toUpperCase()}`,
        jobTitle: "the requested position", 
        customMessage: body, // For custom message or overridden text
      });
      onSuccess();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to send email."));
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden p-6 text-center">
          <h2 className="text-xl font-bold mb-4">Confirm Send</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to send this {type} email to <strong>{applicantEmail}</strong>?
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading}>
              {loading ? "Sending..." : "Confirm & Send"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">Compose Email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 dark:text-muted-foreground">
            &times;
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-status-danger-surface text-status-danger-foreground rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-[100px_1fr] items-center gap-2 text-sm">
            <span className="font-medium text-gray-500 dark:text-muted-foreground">To:</span>
            <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-md text-gray-700 dark:text-gray-200">
              {applicantName} &lt;{applicantEmail}&gt;
            </span>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2 text-sm">
            <span className="font-medium text-gray-500 dark:text-muted-foreground">Template:</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-2 text-sm">
            <span className="font-medium text-gray-500 dark:text-muted-foreground">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={previewing}
              className="p-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 w-full"
            />
          </div>

          <div className="mt-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={previewing}
              rows={12}
              className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono text-sm resize-none"
            />
          </div>
        </div>
        
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="review" onClick={() => setShowConfirm(true)} disabled={previewing || !subject || !body}>
            Preview & Send
          </Button>
        </div>
      </div>
    </div>
  );
}
