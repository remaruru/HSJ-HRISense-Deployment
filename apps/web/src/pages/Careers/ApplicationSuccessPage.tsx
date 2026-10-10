import { Link, useLocation } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, Home, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApplicationSuccessPage() {
  // @ts-ignore
  const { search } = useLocation();
  const state = (search || {}) as {
    referenceNumber?: string;
    jobTitle?: string;
    statusToken?: string;
  };

  // If accessed directly without state, just show a generic success or redirect.
  const referenceNumber = state.referenceNumber || "Unknown Reference";
  const jobTitle = state.jobTitle || "the position";
  const statusPath = state.statusToken
    ? `/careers/application-status/${state.statusToken}`
    : null;

  const copyRef = () => {
    if (state.referenceNumber) {
      navigator.clipboard.writeText(state.referenceNumber);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-status-success-surface mb-8 shadow-pop-color shadow-green-500/20 dark:bg-status-success-surface">
        <CheckCircle2 className="h-10 w-10 text-success dark:text-status-success-foreground" />
      </div>
      
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
        Application Submitted Successfully
      </h1>
      
      <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
        Your application has been submitted successfully. Please keep your application reference number for your records. Hospicio de San Jose Human Resources will contact you through the email address or mobile number you provided regarding the next steps.
      </p>

      <div className="bg-slate-50 border border-border rounded-xl p-6 mb-10 max-w-sm mx-auto shadow-sm dark:bg-surface-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Your Application Reference
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl font-mono font-bold text-foreground bg-white px-4 py-2 rounded-lg border border-border select-all dark:bg-surface">
            {referenceNumber}
          </span>
          {state.referenceNumber && (
            <button 
              onClick={copyRef} 
              className="p-2 text-muted-foreground hover:text-primary-600 bg-white border border-border rounded-lg transition-colors hover:shadow-sm dark:hover:text-primary-300 dark:bg-surface"
              title="Copy Reference Number"
            >
              <Copy className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Please keep this reference number for your records.
        </p>
      </div>

      {statusPath && (
        <div className="max-w-lg mx-auto mb-10 rounded-xl border-2 border-primary-200 bg-primary-50 p-6 dark:border-primary-900 dark:bg-primary-900/40">
          <p className="text-sm font-bold text-foreground mb-1">Check your application any time</p>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            We have also emailed you this link. No account or password is needed — please keep the
            link private.
          </p>
          <Link to={statusPath as any}>
            <Button className="gap-2">
              View my application status <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link to={"/careers" as any} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto gap-2">
            View More Openings
          </Button>
        </Link>
        <Link to={"/" as any} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto gap-2 shadow-pop-color">
            <Home className="h-4 w-4" />
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
