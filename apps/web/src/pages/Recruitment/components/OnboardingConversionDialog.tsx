import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecruitmentService } from "@/services/recruitment.service";
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface OnboardingConversionDialogProps {
  applicationId: string;
  application: any;
  onClose: () => void;
  onSuccess: (draftId: string) => void;
}

export function OnboardingConversionDialog({
  applicationId,
  application,
  onClose,
  onSuccess
}: OnboardingConversionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    try {
      const draft = await RecruitmentService.convertToOnboarding(applicationId);
      onSuccess(draft.id);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to convert to onboarding draft."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden p-6 text-center">
        <h2 className="text-xl font-bold mb-4">Convert to Onboarding</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-status-danger-surface text-status-danger-foreground rounded-md text-sm text-left">
            {error}
          </div>
        )}

        <div className="text-left space-y-3 text-sm text-gray-700 dark:text-gray-300 mb-6">
          <p>
            You are about to convert this HIRED application into an Onboarding Draft for <strong>{application.applicant.firstName} {application.applicant.lastName}</strong>.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md border dark:border-gray-600 space-y-1">
            <p className="font-medium">The following fields will be transferred:</p>
            <ul className="list-disc pl-5">
              <li>Name & Contact Information</li>
              <li>Unit & Department</li>
              <li>Job Role & Employment Status</li>
            </ul>
          </div>
          <div className="bg-status-warning-surface text-status-warning-foreground p-3 rounded-md border border-status-warning-border">
            <p className="font-semibold flex items-center gap-1">
              <span className="text-lg">⚠</span> Important Notice
            </p>
            <ul className="list-disc pl-5 mt-1">
              <li>This creates an <strong>OnboardingDraft only</strong>.</li>
              <li>No Employee or User account is created yet.</li>
              <li>No password or credentials are generated.</li>
              <li>An acceptance email is not sent automatically.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading}>
            {loading ? "Converting..." : "Confirm & Convert"}
          </Button>
        </div>
      </div>
    </div>
  );
}
