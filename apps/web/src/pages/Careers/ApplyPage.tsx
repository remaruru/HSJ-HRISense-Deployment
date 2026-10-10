import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, AlertCircle, AlertTriangle, UploadCloud, X, Check, RefreshCw } from "lucide-react";
import { PublicRecruitmentService, PublicJobOpening, SubmitApplicationPayload } from "@/services/public-recruitment.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReligionPicker } from "@/components/shared/ReligionPicker";
import { RecaptchaCheckbox } from "@/components/common/RecaptchaCheckbox";
import { getCaptchaConfig } from "@/services/captcha.service";
import { cn } from "@/lib/utils";
import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiErrorStatus,
  getApiFieldErrors,
  isNetworkError,
  isTimeoutError,
} from "@/utils/error-handler.util";

/** Same limits the server enforces (public-recruitment.routes.ts). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = /\.(pdf|docx?)$/i;

/** Same loose rule as the server: digits with spaces, dashes, brackets or a leading +, 7–15 digits. */
const isPlausiblePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[\d\s()-]+$/.test(value) && digits >= 7 && digits <= 15;
};

/** Fields that can carry their own message, in the order they appear on the form. */
const FIELD_ORDER = ["firstName", "lastName", "email", "mobileNumber", "gender", "religion", "presentAddress", "resume", "coverLetter", "source", "message", "privacyConsent", "captcha"] as const;
type FieldErrors = Partial<Record<string, string>>;

/** A failure the applicant needs to read: what happened, and what to do next. */
interface SubmitProblem {
  title: string;
  message: string;
  /** Warning for "already done" conflicts; danger for failures. */
  tone: "warning" | "danger";
  /** Offer a link back to the Careers list (the opening closed meanwhile). */
  backToCareers?: boolean;
}

export default function ApplyPage() {
  const { openingSlug } = useParams({ strict: false }) as any;
  const navigate = useNavigate();

  const [opening, setOpening] = useState<PublicJobOpening | null>(null);
  const [loadingOpening, setLoadingOpening] = useState(true);
  const [openingError, setOpeningError] = useState<"not-found" | "load-failed" | null>(null);
  const [openingErrorMessage, setOpeningErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Form State
  const [formData, setFormData] = useState<SubmitApplicationPayload>({
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    email: "",
    mobileNumber: "",
    presentAddress: "",
    gender: "",
    religion: "",
    source: "",
    message: "",
    privacyConsent: false
  });

  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: a double-click lands before React re-renders the disabled
  // button, and must still send only one application.
  const inFlight = useRef(false);
  const [problem, setProblem] = useState<SubmitProblem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // "I'm not a robot" — shown only when HRISense has it switched on.
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  useEffect(() => {
    let alive = true;
    getCaptchaConfig().then((c) => {
      if (alive && c.enabled && c.siteKey) setCaptchaSiteKey(c.siteKey);
    });
    return () => {
      alive = false;
    };
  }, []);
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOpening = async () => {
      setLoadingOpening(true);
      setOpeningError(null);
      try {
        const data = await PublicRecruitmentService.getOpeningBySlug(openingSlug);
        setOpening(data);
      } catch (err) {
        // 404 means the opening is closed or unknown. Anything else (offline, a
        // server problem, rate limit) is a loading failure that can be retried —
        // never reported as "no longer accepting applications".
        if (getApiErrorStatus(err) === 404) {
          setOpeningError("not-found");
        } else {
          setOpeningError("load-failed");
          setOpeningErrorMessage(getApiErrorMessage(err, "This application form could not be loaded."));
        }
      } finally {
        setLoadingOpening(false);
      }
    };
    if (openingSlug) {
      fetchOpening();
    }
  }, [openingSlug, reloadKey]);

  // Bring a submission problem into view where the applicant is looking, and
  // move focus to it so screen readers announce it.
  useEffect(() => {
    if (problem && problemRef.current) {
      problemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      problemRef.current.focus({ preventScroll: true });
    }
  }, [problem]);

  const clearFieldError = (name: string) =>
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

  /** Focus the first field with a problem, in form order. */
  const focusFirstInvalid = (errors: FieldErrors) => {
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    const el = document.getElementById(first);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  };

  /** The form's own checks, before anything is sent. The server checks again. */
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!formData.firstName.trim()) errors.firstName = "First name is required.";
    if (!formData.lastName.trim()) errors.lastName = "Last name is required.";
    const email = formData.email.trim();
    if (!email) errors.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address, like name@example.com.";
    const mobile = formData.mobileNumber.trim();
    if (!mobile) errors.mobileNumber = "Mobile number is required.";
    else if (!isPlausiblePhoneNumber(mobile)) errors.mobileNumber = "Enter a valid mobile number using digits only, like 09171234567.";
    if (!resume) errors.resume = "Please attach your résumé (PDF, DOC or DOCX).";
    if (!formData.privacyConsent) errors.privacyConsent = "You must give privacy consent before submitting your application.";
    if (captchaSiteKey && !captchaToken) errors.captcha = 'Please tick "I\'m not a robot".';
    return errors;
  };

  /** What went wrong with a submission, in the applicant's terms. */
  const describeFailure = (err: unknown): SubmitProblem => {
    const code = getApiErrorCode(err);
    const status = getApiErrorStatus(err);
    const message = getApiErrorMessage(err, "We could not submit your application. Please try again.");

    if (code === "DUPLICATE_APPLICATION") {
      return {
        title: "Application already submitted",
        message: `${message} If you already applied, please use the application status link in your confirmation email instead of submitting another application.`,
        tone: "warning",
      };
    }
    if (code === "OPENING_NOT_ACCEPTING" || code === "OPENING_NOT_FOUND" || status === 404) {
      return { title: "This opening is no longer accepting applications", message, tone: "warning", backToCareers: true };
    }
    if (code === "VALIDATION_ERROR") {
      return { title: "Please check your application", message, tone: "danger" };
    }
    if (code === "FILE_TOO_LARGE" || code === "UNSUPPORTED_FILE_TYPE" || code === "TOO_MANY_FILES" || code === "UPLOAD_REJECTED" || status === 413) {
      return { title: "There is a problem with a document", message, tone: "danger" };
    }
    if (status === 429) {
      return { title: "Too many attempts", message, tone: "warning" };
    }
    if (isTimeoutError(err)) {
      return {
        title: "This is taking too long",
        message: "The request took too long. Your application may still have been received — check your email for a confirmation before trying again.",
        tone: "danger",
      };
    }
    if (isNetworkError(err)) {
      return { title: "Unable to connect", message, tone: "danger" };
    }
    return { title: "We couldn't submit your application", message, tone: "danger" };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    clearFieldError(name);
    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "resume" | "coverLetter",
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_BYTES) {
        setFieldErrors((prev) => ({ ...prev, [field]: `"${file.name}" is larger than the 5 MB limit. Choose a smaller file.` }));
        e.target.value = "";
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
        setFieldErrors((prev) => ({ ...prev, [field]: `"${file.name}" is not a PDF or Word document. Choose a PDF, DOC or DOCX file.` }));
        e.target.value = "";
        return;
      }
      setter(file);
      clearFieldError(field);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opening || inFlight.current) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setProblem(null);
      focusFirstInvalid(errors);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setProblem(null);

    try {
      // Submit Application Data with Files. What was typed and attached stays
      // in the form whatever happens, so a failure never means starting over.
      const res = await PublicRecruitmentService.submitApplication(opening.id, formData, resume!, coverLetter, captchaToken);

      // Navigate to success
      ;(navigate as any)({
        to: "/careers/application-success",
        search: {
          referenceNumber: res.referenceNumber,
          jobTitle: opening.title,
          statusToken: res.statusToken,
        }
      });
      
    } catch (err) {
      const serverFields = getApiFieldErrors(err);
      if (Object.keys(serverFields).length > 0) setFieldErrors(serverFields);
      setProblem(describeFailure(err));
      // A checkbox result works once: clear it so the applicant ticks it again.
      if (captchaSiteKey) setCaptchaReset((n) => n + 1);
    } finally {
      // Every path ends here: the button is usable again after any failure.
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /** Props that tie an input to its message, for screen readers and styling. */
  const fieldA11y = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
      : { "aria-invalid": undefined, "aria-describedby": undefined };
  const fieldErrorText = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-xs font-medium text-status-danger-foreground">
        {fieldErrors[name]}
      </p>
    ) : null;
  const invalidRing = (name: string) => (fieldErrors[name] ? "border-status-danger-foreground focus-visible:ring-status-danger-foreground/40" : "");

  if (loadingOpening) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin mb-4 dark:border-primary-900" />
        <p>Loading application form...</p>
      </div>
    );
  }

  if (openingError === "load-failed") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" role="alert">
        <AlertCircle className="h-16 w-16 text-danger mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-4">We couldn't load this form</h1>
        <p className="text-lg text-muted-foreground mb-8">{openingErrorMessage}</p>
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

  if (openingError || !opening) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="h-16 w-16 text-warning-dark mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-4">Opening Unavailable</h1>
        <p className="text-lg text-muted-foreground mb-8">
          This position is no longer accepting applications.
        </p>
        <Link to={"/careers" as any}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Careers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link 
        to={`/careers/${opening.slug}` as any} 
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Opening
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Submit Application</h1>
        <p className="text-muted-foreground">
          You are applying for <span className="font-semibold text-foreground">{opening.title}</span> in <span className="font-semibold text-foreground">{opening.department?.name || opening.unit.name}</span>.
        </p>
      </div>

      {/* noValidate: the form's own checks run instead of browser bubbles, so
          every problem is written next to its field and announced. */}
      <form noValidate onSubmit={handleSubmit} className="space-y-8 bg-white border border-border rounded-2xl p-6 sm:p-10 shadow-sm dark:bg-surface">

        {/* Personal Details */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name *</label>
              <Input id="firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className={invalidRing("firstName")} {...fieldA11y("firstName")} />
              {fieldErrorText("firstName")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name *</label>
              <Input id="lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className={invalidRing("lastName")} {...fieldA11y("lastName")} />
              {fieldErrorText("lastName")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="middleName" className="text-sm font-medium text-foreground">Middle Name</label>
              <Input id="middleName" name="middleName" value={formData.middleName} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="suffix" className="text-sm font-medium text-foreground">Suffix (e.g. Jr, Sr)</label>
              <Input id="suffix" name="suffix" value={formData.suffix} onChange={handleChange} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address *</label>
              <Input id="email" name="email" type="email" required autoComplete="email" value={formData.email} onChange={handleChange} className={invalidRing("email")} {...fieldA11y("email")} />
              {fieldErrorText("email")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobileNumber" className="text-sm font-medium text-foreground">Mobile Number *</label>
              <Input id="mobileNumber" name="mobileNumber" type="tel" required inputMode="tel" autoComplete="tel" value={formData.mobileNumber} onChange={handleChange} className={invalidRing("mobileNumber")} {...fieldA11y("mobileNumber")} />
              {fieldErrorText("mobileNumber")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gender" className="text-sm font-medium text-foreground">
                Sex <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              >
                {/* Optional: leaving it on "Not specified" submits no value. */}
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="religion" className="text-sm font-medium text-foreground">
                Religion <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              {/* Pick from the list, choose "Others" and write it in, or leave it blank. */}
              <ReligionPicker
                optional
                value={formData.religion ?? ""}
                onChange={(religion) => setFormData((prev) => ({ ...prev, religion }))}
                controlClass="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
            </div>
            {/* Last in the section: it is the only full-width field, so it reads
                as the end of the block rather than splitting the paired ones. */}
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="presentAddress" className="text-sm font-medium text-foreground">Present Address</label>
              <Input id="presentAddress" name="presentAddress" value={formData.presentAddress} onChange={handleChange} />
            </div>
          </div>
        </section>

        {/* Documents */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">Documents</h2>
          <div className="space-y-6">
            
            {/* Resume Upload */}
            <div className="space-y-2">
              <label htmlFor="resume" className="text-sm font-medium text-foreground">Résumé / CV * (PDF or DOC/DOCX, max 5MB)</label>
              <div className={cn("border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 relative focus-within:ring-2 focus-within:ring-primary-500/40 dark:bg-surface-2/50", fieldErrors.resume && "border-status-danger-foreground")}>
                {resume ? (
                  <div className="flex items-center gap-3 text-sm font-medium text-foreground bg-white border border-border p-3 rounded-lg shadow-sm dark:bg-surface">
                    <FileText className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                    <span className="truncate max-w-[200px]">{resume.name}</span>
                    <button type="button" onClick={() => setResume(null)} aria-label="Remove résumé" className="text-muted-foreground hover:text-danger transition-colors ml-2">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-foreground">Click to upload resume</span>
                    <Input id="resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, "resume", setResume)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required {...fieldA11y("resume")} />
                  </>
                )}
              </div>
              {fieldErrorText("resume")}
            </div>

            {/* Cover Letter Upload */}
            <div className="space-y-2">
              <label htmlFor="coverLetter" className="text-sm font-medium text-foreground">Cover Letter (Optional, max 5MB)</label>
              <div className={cn("border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 relative focus-within:ring-2 focus-within:ring-primary-500/40 dark:bg-surface-2/50", fieldErrors.coverLetter && "border-status-danger-foreground")}>
                {coverLetter ? (
                  <div className="flex items-center gap-3 text-sm font-medium text-foreground bg-white border border-border p-3 rounded-lg shadow-sm dark:bg-surface">
                    <FileText className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                    <span className="truncate max-w-[200px]">{coverLetter.name}</span>
                    <button type="button" onClick={() => setCoverLetter(null)} aria-label="Remove cover letter" className="text-muted-foreground hover:text-danger transition-colors ml-2">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-foreground">Click to upload cover letter</span>
                    <Input id="coverLetter" type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, "coverLetter", setCoverLetter)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" {...fieldA11y("coverLetter")} />
                  </>
                )}
              </div>
              {fieldErrorText("coverLetter")}
            </div>

          </div>
        </section>

        {/* Additional Info */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4 pb-2 border-b border-border">Additional Information</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="source" className="text-sm font-medium text-foreground">How did you hear about us?</label>
              <Input id="source" name="source" value={formData.source} onChange={handleChange} placeholder="e.g. LinkedIn, JobStreet, Referral" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="message" className="text-sm font-medium text-foreground">Message / Cover Note (Optional)</label>
              <textarea 
                id="message" 
                name="message" 
                value={formData.message} 
                onChange={handleChange} 
                placeholder="Brief message to the hiring team..." 
                rows={4} 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        {/* Privacy Consent */}
        <section>
          <div className={`flex items-start gap-4 p-5 rounded-xl border ${fieldErrors.privacyConsent ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30 border-border'}`}>
            <div className="relative flex items-center justify-center mt-0.5">
              <input 
                type="checkbox" 
                id="privacyConsent" 
                name="privacyConsent"
                className="peer sr-only"
                required
                checked={formData.privacyConsent}
                onChange={handleChange}
                aria-invalid={fieldErrors.privacyConsent ? true : undefined}
                aria-describedby={fieldErrors.privacyConsent ? "privacyConsent-error privacyConsent-description" : "privacyConsent-description"}
              />
              <label htmlFor="privacyConsent" className="h-5 w-5 rounded border-2 border-border bg-surface peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600/50 transition-colors flex items-center justify-center cursor-pointer">
                {formData.privacyConsent && (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                )}
              </label>
            </div>
            <div className="space-y-1.5 flex-1">
              <label htmlFor="privacyConsent" className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
                Privacy Consent <span className="text-destructive" aria-label="Required">*</span>
              </label>
              <label htmlFor="privacyConsent" className="text-sm text-foreground/90 cursor-pointer block leading-relaxed">
                I consent to Hospicio de San Jose collecting and processing the personal information and documents I provide for the purpose of evaluating and managing my job application.
              </label>
              <p id="privacyConsent-description" className="text-xs text-muted-foreground mt-1">
                Your information will be used only for recruitment-related processing.
              </p>
              {fieldErrorText("privacyConsent")}
            </div>
          </div>
        </section>

        {captchaSiteKey && (
          <section id="captcha" tabIndex={-1} className="space-y-2 outline-none" aria-label="Robot check">
            <RecaptchaCheckbox
              siteKey={captchaSiteKey}
              resetKey={captchaReset}
              onToken={(token) => {
                setCaptchaToken(token);
                if (token) clearFieldError("captcha");
              }}
            />
            {fieldErrorText("captcha")}
          </section>
        )}

        {/* The answer to "what happened?" sits right above the button that was
            pressed, gets focus, and is announced — never off-screen at the top. */}
        {problem && (
          <div
            ref={problemRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className={cn(
              "flex gap-3 items-start rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              problem.tone === "warning"
                ? "bg-status-warning-surface border-status-warning-border text-status-warning-foreground"
                : "bg-status-danger-surface border-status-danger-border text-status-danger-foreground"
            )}
          >
            {problem.tone === "warning" ? (
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold">{problem.title}</p>
              <p className="text-sm break-words">{problem.message}</p>
              {problem.backToCareers && (
                <Link to={"/careers" as any} className="inline-block pt-1 text-sm font-semibold underline underline-offset-2">
                  See current job positions
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setProblem(null)}
              aria-label="Dismiss message"
              className="ml-auto shrink-0 rounded p-1 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-border flex justify-end">
          <Button type="submit" disabled={submitting} aria-busy={submitting} className="w-full sm:w-auto h-12 px-8 text-base shadow-pop-color">
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Submitting Application...
              </span>
            ) : (
              "Submit Application"
            )}
          </Button>
        </div>

      </form>
    </div>
  );
}
