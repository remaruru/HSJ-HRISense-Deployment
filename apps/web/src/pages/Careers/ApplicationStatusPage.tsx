import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { CheckCircle2, Clock, FileQuestion, Home, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/services/api';
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/error-handler.util';

interface ApplicationStatus {
  referenceNumber: string;
  applicantFirstName: string;
  jobTitle: string;
  jobReferenceNumber: string;
  unitName: string | null;
  submittedAt: string;
  lastUpdatedAt: string;
  stage: { label: string; description: string };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Public, login-free application status page.
 *
 * Reached only through the secure link in the applicant's email. Applicants do
 * NOT have HRISense accounts — this is read-only visibility of one application,
 * and the API returns only public-safe fields.
 */
export default function ApplicationStatusPage() {
  const { statusToken } = useParams({ strict: false }) as { statusToken?: string };

  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!statusToken) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    publicApi
      .get(`/public/recruitment/application-status/${statusToken}`)
      .then((res) => {
        if (cancelled) return;
        setStatus(res.data?.data ?? null);
        setNotFound(!res.data?.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (getApiErrorStatus(err) === 404) setNotFound(true);
        else setLoadError(getApiErrorMessage(err, 'Your application status could not be loaded. Please try again.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusToken, reloadKey]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4 dark:text-primary-300" />
        <p className="text-muted-foreground">Checking your application...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" role="alert">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">We couldn't check your application</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">{loadError}</p>
        <Button onClick={() => setReloadKey((k) => k + 1)}>Try Again</Button>
      </div>
    );
  }

  if (notFound || !status) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted border-2 border-border mb-6">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          This status link is not valid
        </h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
          The link may be incomplete or out of date. Open the link exactly as it appears in your
          confirmation email, or contact the Hospicio de San Jose HR Department for help.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={'/careers' as any}>
            <Button variant="outline">View job openings</Button>
          </Link>
          <Link to={'/' as any}>
            <Button className="gap-2">
              <Home className="h-4 w-4" /> Return home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:py-20">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 border-2 border-primary-200 mb-5 dark:bg-primary-900/40 dark:border-primary-900">
          <CheckCircle2 className="h-8 w-8 text-primary-600 dark:text-primary-300" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Hello, {status.applicantFirstName}
        </h1>
        <p className="text-muted-foreground">
          Here is the current status of your application to Hospicio de San Jose.
        </p>
      </div>

      {/* Current stage */}
      <div className="bg-primary-50 border-2 border-primary-200 rounded-2xl p-6 mb-6 text-center dark:bg-primary-900/40 dark:border-primary-900">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-700 mb-2 dark:text-primary-300">
          Current status
        </p>
        <p className="text-xl font-bold text-foreground mb-2">{status.stage.label}</p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          {status.stage.description}
        </p>
      </div>

      {/* Details */}
      <div className="bg-surface border-2 border-border rounded-2xl divide-y divide-border">
        <DetailRow label="Application reference" value={status.referenceNumber} mono />
        <DetailRow label="Position" value={status.jobTitle} />
        {status.unitName && <DetailRow label="Service unit" value={status.unitName} />}
        <DetailRow label="Date submitted" value={formatDate(status.submittedAt)} />
        <DetailRow label="Last updated" value={formatDate(status.lastUpdatedAt)} />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1">What happens next</p>
            <p>
              The HR Department will contact you using the email address or mobile number you
              provided. You can return to this page at any time using the link from your email —
              no account or password is needed. Please keep the link private.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
        <Link to={'/careers' as any}>
          <Button variant="outline">View more openings</Button>
        </Link>
        <Link to={'/' as any}>
          <Button className="gap-2">
            <Home className="h-4 w-4" /> Return home
          </Button>
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-5 py-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold text-foreground ${mono ? 'font-mono select-all' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
