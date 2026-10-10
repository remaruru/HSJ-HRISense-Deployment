import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, CheckCircle2 } from "lucide-react";
import { OnboardingConversionDialog } from "./OnboardingConversionDialog";

interface ApplicantOnboardingSectionProps {
  applicationId: string;
  application: any;
  canConvert: boolean;
  onRefresh: () => void;
}

export function ApplicantOnboardingSection({
  applicationId,
  application,
  canConvert,
  onRefresh
}: ApplicantOnboardingSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isHired = application.status === "HIRED";
  const hasDraft = !!application.onboardingDraftId;
  const isEligible = isHired && !hasDraft && canConvert;

  const handleSuccess = (draftId: string) => {
    setIsDialogOpen(false);
    onRefresh();
  };

  if (!isHired && !hasDraft) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Briefcase className="w-5 h-5" /> Hiring & Onboarding
        </h3>
      </div>
      
      <div className="p-5">
        {hasDraft ? (
          <div className="bg-status-success-surface text-status-success-foreground p-4 rounded-lg border border-status-success-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-status-success-foreground" />
              <div>
                <p className="font-medium">Applicant successfully converted to Onboarding Draft.</p>
                <p className="text-sm mt-1 opacity-80">Draft ID: {application.onboardingDraftId}</p>
              </div>
            </div>
            <Link to="/employees/onboard" search={{ draftId: application.onboardingDraftId }} className="text-status-success-foreground font-medium hover:underline flex items-center gap-1 text-sm">
              Resume Draft <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : isEligible ? (
          <div className="bg-status-info-surface text-status-info-foreground p-4 rounded-lg border border-status-info-border flex items-center justify-between">
            <div>
              <p className="font-medium">Applicant is ready for onboarding.</p>
              <p className="text-sm mt-1 opacity-80">Converting will create an Onboarding Draft transferring their information.</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-slate-600 hover:bg-slate-700 text-white border-0">
              Convert to Onboarding
            </Button>
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-muted-foreground">
            Cannot convert to onboarding. The applicant must be in HIRED status and you must have permission to convert.
          </div>
        )}
      </div>

      {isDialogOpen && (
        <OnboardingConversionDialog
          applicationId={applicationId}
          application={application}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
