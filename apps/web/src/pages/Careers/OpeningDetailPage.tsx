import { useState, useEffect } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Building2, CalendarDays, Clock, FileText, CheckCircle, Briefcase, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { PublicRecruitmentService, PublicJobOpening } from "@/services/public-recruitment.service";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/error-handler.util";

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
};

export default function OpeningDetailPage() {
  const { openingSlug } = useParams({ strict: false }) as any;
  const [opening, setOpening] = useState<PublicJobOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchOpening = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await PublicRecruitmentService.getOpeningBySlug(openingSlug);
        setOpening(data);
      } catch (err) {
        if (getApiErrorStatus(err) === 404) {
          setError("not-found");
        } else {
          setError("network-error");
          setErrorMessage(getApiErrorMessage(err, "This opening could not be loaded. Please try again."));
        }
      } finally {
        setLoading(false);
      }
    };
    if (openingSlug) {
      fetchOpening();
    }
  }, [openingSlug, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin mb-4 dark:border-primary-900" />
        <p>Loading opening details...</p>
      </div>
    );
  }

  if (error === "not-found") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="h-16 w-16 text-warning-dark mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-4">Opening Unavailable</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The job opening you are looking for may have been closed, filled, or does not exist.
        </p>
        <Link to={"/careers" as any}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Careers
          </Button>
        </Link>
      </div>
    );
  }

  if (error === "network-error" || !opening) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="h-16 w-16 text-danger mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-4">Unable to Load</h1>
        <p className="text-lg text-muted-foreground mb-8" role="alert">
          {errorMessage || "There was a problem connecting to our servers. Please try again."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={() => setReloadKey((k) => k + 1)} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Link to={"/careers" as any}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Careers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link 
        to={"/careers" as any} 
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all openings
      </Link>

      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden mb-8 dark:bg-surface">
        <div className="p-6 sm:p-10 border-b border-border bg-slate-50/50 dark:bg-surface-2/50">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            {opening.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-y-4 gap-x-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              <span className="font-medium text-foreground">{opening.department?.name || opening.unit.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              <span className="font-medium text-foreground capitalize">{opening.employmentType.replace('_', ' ').toLowerCase()}</span>
            </div>
            {opening.vacancies && opening.vacancies > 0 && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                <span className="font-medium text-foreground">{opening.vacancies} Vacanc{opening.vacancies === 1 ? 'y' : 'ies'}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-warning-dark" />
              <span className="font-medium text-foreground">Closes {formatDate(opening.closingDate)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-10">
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" /> Overview
            </h2>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap">
              {opening.description}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" /> Key Responsibilities
            </h2>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap">
              {opening.responsibilities}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" /> Qualifications
            </h2>
            <div className="text-foreground leading-relaxed whitespace-pre-wrap">
              {opening.qualifications}
            </div>
          </section>

          {opening.requiredDocuments && (
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" /> Required Documents
              </h2>
              <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                {opening.requiredDocuments}
              </div>
            </section>
          )}
        </div>

        <div className="p-6 sm:p-10 border-t border-border bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6 dark:bg-surface-2">
          <div>
            <h3 className="font-bold text-foreground">Ready to make an impact?</h3>
            <p className="text-sm text-muted-foreground mt-1">Submit your application before the closing date.</p>
          </div>
          <Link to={`/careers/${opening.slug}/apply` as any} className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gap-2 shadow-pop-color text-base font-semibold px-8 py-6 h-auto rounded-xl">
              Apply Now
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
