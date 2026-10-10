import { useState, useEffect, useRef } from"react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { motion } from"framer-motion";
import { ArrowLeft, ArrowRight, AlertTriangle, BookOpen, CheckCircle2, Save, Download, Copy, Eye, FileText, Loader2, UserPlus, Mail, Briefcase, Shield, Phone, User } from"lucide-react";
import {
  BLOOD_TYPES, RECORD_FIELD_DEFAULTS, credentialValidity, graduatedLabel, recordFieldCascade, recordFieldErrors,
} from "@/lib/employeeRecord";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { scheduleApi } from "@/services/api/schedule";
import { toast } from"sonner";
import { jsPDF } from "jspdf";
import { OrgSelector } from "@/components/common/OrgSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { HelpLink } from "@/components/common/HelpLink";
import {
  EMPLOYMENT_STATE_LABELS, ENDING_OPTIONS, formatEmploymentDate, hasEnded, type EmploymentState,
} from "@/lib/employment";
import { ReligionPicker } from "@/components/shared/ReligionPicker";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import {
 contactProblems, emptyContact, filledContacts, filledGovernmentIds, governmentIdProblems, upgradeDraftData,
 type EmergencyContactRow, type GovernmentIdRow,
} from "@/lib/employeeContacts";
import { EmergencyContactsEditor } from "./components/EmergencyContactsEditor";
import { GovernmentIdRowsEditor } from "./components/GovernmentIdRowsEditor";

const STEPS = [
  "Personal Information",
  "Contact & Address",
  "Employment Details",
  "Government Numbers",
  "Emergency Contacts",
  "Education & Licenses",
  "Document Uploads",
  "Review & Confirm"
];

export default function EmployeeOnboardingPage() {
 const navigate = useNavigate();
 const search: any = useSearch({ strict: false });
 const draftId = search.draftId;
 const [currentStep, setCurrentStep] = useState(0);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [isLoading, setIsLoading] = useState(true);
 const [hasError, setHasError] = useState(false);
 const [isSavingDraft, setIsSavingDraft] = useState(false);
 const [supervisorPreview, setSupervisorPreview] = useState<any>(null);
 const [isResolvingSupervisor, setIsResolvingSupervisor] = useState(false);
 const [isSuccess, setIsSuccess] = useState(false);
 
 const [units, setUnits] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [jobRoles, setJobRoles] = useState<any[]>([]);
 const [scheduleTemplates, setScheduleTemplates] = useState<any[]>([]);
 const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
 const [isDirty, setIsDirty] = useState(false);
 
 const [createdEmployee, setCreatedEmployee] = useState<any>(null);
 const [onboardingWarnings, setOnboardingWarnings] = useState<string[]>([]);
 const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
 
 const [formData, setFormData] = useState({
 firstName: "",
 middleName: "",
 lastName: "",
 suffix: "",
 gender:"MALE",
 dateOfBirth: "",
 placeOfBirth: "",
 civilStatus:"SINGLE",
 nationality:"Filipino",
 religion: "",
 personalEmail: "",
 mobilePhone: "",
 telephoneNumber: "",
 homePhone: "",
 presentAddress: "",
 permanentAddress: "",
 emergencyContacts: [emptyContact()] as EmergencyContactRow[],
 unitId: "",
 departmentId: "",
 jobRoleId: "",
 supervisorId: "",
 // HR may replace the automatically resolved supervisor (with a reason).
 supervisorOverrideId: "",
 supervisorOverrideReason: "",
 // HR-managed leave eligibility — never inferred from any profile field.
 paternityLeaveEligible: false,
 soloParentLeaveEligible: false,
 employmentStatus:"REGULAR",
 employmentState:"ACTIVE",
 workSchedule:"REGULAR_DAY_SHIFT",
 scheduleTemplateId: "",
 hireDate: new Date().toISOString().split('T')[0],
 probationDate: "",
 regularizationDate: "",
 separationDate: "",
 separationReason: "",
 prcLicenseNumber: "",
 professionalRole: "",
 sssNumber: "",
 philhealthNumber: "",
 pagibigNumber: "",
 tinNumber: "",
 otherGovernmentIdRows: [] as GovernmentIdRow[],
 // Optional HSJ record fields (blood type, spouse, residence, PRC dates, NC,
 // education). Blank = not provided; nothing is pre-filled.
 ...RECORD_FIELD_DEFAULTS,
 });
 const [eligibleSupervisors, setEligibleSupervisors] = useState<any[]>([]);
 const [overrideOpen, setOverrideOpen] = useState(false);

 const [files, setFiles] = useState<{
 profilePicture: File | null;
 resume: File | null;
 contract: File | null;
 governmentIds: File[];
 otherDocuments: File[];
 }>({
 profilePicture: null,
 resume: null,
 contract: null,
 governmentIds: [],
 otherDocuments: []
 });

 const [errorDetails, setErrorDetails] = useState<string>("");

 const fetchDropdownsAndDraft = async () => {
 setIsLoading(true);
 setHasError(false);
 setErrorDetails("");
 try {
 // Fetch required master data
 const [unitsRes, rolesRes, templatesRes, supervisorsRes] = await Promise.all([
 api.get('/employees/units'),
 api.get('/employees/job-roles'),
 scheduleApi.getTemplates(),
 api.get('/employees/eligible-supervisors').catch(() => ({ data: { data: [] } })),
 ]);
 setUnits(unitsRes.data?.data || []);
 setEligibleSupervisors(supervisorsRes.data?.data || []);
 setJobRoles(rolesRes.data?.data || []);
 setScheduleTemplates(templatesRes.filter(t => !t.isArchived));

 // Fetch optional master data (departments) without blocking if it fails
 try {
 const deptsRes = await api.get('/departments');
 setDepartments(deptsRes.data?.data || []);
 } catch (deptErr) {
 console.warn("Optional departments endpoint failed to load", deptErr);
 setDepartments([]);
 }

 if (draftId) {
 const draftRes = await api.get(`/onboarding-drafts/${draftId}`);
 const d = draftRes.data?.data?.data;
 // Drafts saved before contacts / IDs became lists are upgraded here.
 if (d) {
 const upgraded = upgradeDraftData(d);
 setFormData(prev => ({ ...prev, ...upgraded }));
 if (upgraded.supervisorOverrideId) setOverrideOpen(true);
 }
 }
 } catch (error: any) {
 console.error("Failed to fetch required onboarding data", error);
 setHasError(true);
 // Never a raw JS error or stack text — the reason in words, or the fallback.
 setErrorDetails(getApiErrorMessage(error, "The onboarding form could not be loaded. Please try again."));
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 fetchDropdownsAndDraft();
 }, [draftId]);

 useEffect(() => {
 const resolveSupervisor = async () => {
 if (!formData.jobRoleId) {
 setSupervisorPreview(null);
 return;
 }
 setIsResolvingSupervisor(true);
 try {
 const res = await api.post('/employees/resolve-supervisor', {
 jobRoleId: formData.jobRoleId,
 unitId: formData.unitId,
 departmentId: formData.departmentId || null,
 });
 setSupervisorPreview(res.data?.data || null);
 } catch (error) {
 console.error("Failed to resolve supervisor preview", error);
 setSupervisorPreview(null);
 } finally {
 setIsResolvingSupervisor(false);
 }
 };
 resolveSupervisor();
 }, [formData.jobRoleId, formData.unitId, formData.departmentId]);

 useEffect(() => {
 if (stepRefs.current[currentStep]) {
 stepRefs.current[currentStep]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
 }
 }, [currentStep]);

 const handleReturn = () => {
 if (isDirty) {
 if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
 navigate({ to: "/employees", search: {} as any });
 }
 } else {
 navigate({ to: "/employees", search: {} as any });
 }
 };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
 setIsDirty(true);
 const { name, value } = e.target;
 setFormData(prev => {
 const updated = { ...prev, [name]: value };
 
 // Cascading clear logic
 if (name ==="unitId") {
 updated.departmentId = "";
 updated.jobRoleId = "";
 updated.supervisorId = "";
 updated.supervisorOverrideId = "";
 updated.supervisorOverrideReason = "";
 } else if (name ==="departmentId") {
 updated.jobRoleId = "";
 updated.supervisorId = "";
 } else if (name ==="jobRoleId") {
 updated.supervisorId = "";
 }
 // Single → no spouse name; no PRC / NC number → no dates for it.
 Object.assign(updated, recordFieldCascade(name, value));
 
 return updated;
 });
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof typeof files, multiple = false) => {
 setIsDirty(true);
 if (!e.target.files) return;
 if (multiple) {
 setFiles(prev => ({ ...prev, [fieldName]: [...(prev[fieldName] as File[]), ...Array.from(e.target.files!)] }));
 } else {
 setFiles(prev => ({ ...prev, [fieldName]: e.target.files![0] }));
 }
 };

 /**
  * Fields the server refuses to create an employee without. Checking them per
  * step means HR is told on the step that owns the field, instead of reaching
  * Review & Confirm and being rejected there.
  */
 const stepRequirements: Record<number, Array<{ field: keyof typeof formData; label: string }>> = {
 0: [
 { field: 'firstName', label: 'First Name' },
 { field: 'lastName', label: 'Last Name' },
 { field: 'gender', label: 'Sex' },
 { field: 'dateOfBirth', label: 'Date of Birth' },
 { field: 'civilStatus', label: 'Civil Status' },
 ],
 1: [
 { field: 'personalEmail', label: 'Personal Email (login)' },
 { field: 'mobilePhone', label: 'Mobile Number' },
 { field: 'presentAddress', label: 'Present Address' },
 ],
 2: [
 { field: 'unitId', label: 'Unit' },
 { field: 'jobRoleId', label: 'Job Role' },
 { field: 'hireDate', label: 'Date Hired' },
 ],
 };

 const missingForStep = (step: number): string[] => {
 const missing = (stepRequirements[step] ?? [])
 .filter(({ field }) => !String(formData[field] ?? '').trim())
 .map(({ label }) => label);
 if (step === 2 && formData.supervisorOverrideId && !formData.supervisorOverrideReason.trim()) {
 missing.push('Reason for changing the supervisor');
 }
 if (step === 3) missing.push(...governmentIdProblems(formData.otherGovernmentIdRows));
 if (step === 4) missing.push(...contactProblems(formData.emergencyContacts));
 // Optional fields still follow their rules (a PRC date needs the number, …).
 const recordErrors = recordFieldErrors(formData);
 const recordStep: Record<string, number> = { numberOfChildren: 0, spouseName: 0, prcIssuedDate: 5, prcValidUntil: 5, ncValidUntil: 5 };
 for (const [key, message] of Object.entries(recordErrors)) {
 if (recordStep[key] === step && message) missing.push(message);
 }
 return missing;
 };

 const nextStep = () => {
 const missing = missingForStep(currentStep);
 if (missing.length > 0) {
 toast.error(`Please complete: ${missing.join(', ')}.`);
 return;
 }
 setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
 };
 const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

 const handleSaveDraft = async () => {
 setIsSavingDraft(true);
 try {
 if (draftId) {
 await api.put(`/onboarding-drafts/${draftId}`, {
 data: formData,
 status: 'IN_PROGRESS'
 });
 toast.success("Draft updated");
 } else {
 const res = await api.post('/onboarding-drafts', {
 data: formData
 });
 toast.success("Draft saved");
 // @ts-ignore
 navigate({ search: { draftId: res.data.data.id }, replace: true });
 }
 } catch (error: any) {
 toast.error(getApiErrorMessage(error, "Failed to save draft"));
 } finally {
 setIsSavingDraft(false);
 }
 };

 const handleSubmit = async () => {
 setIsSubmitting(true);
 try {
 const data = new FormData();
 Object.entries(formData).forEach(([key, value]) => {
 if (key === 'emergencyContacts') data.append(key, JSON.stringify(filledContacts(value as EmergencyContactRow[])));
 else if (key === 'otherGovernmentIdRows') data.append(key, JSON.stringify(filledGovernmentIds(value as GovernmentIdRow[])));
 else if (typeof value === 'boolean') data.append(key, String(value));
 else if (value) data.append(key, value as string);
 });
 if (files.profilePicture) data.append("profilePicture", files.profilePicture);
 if (files.resume) data.append("resume", files.resume);
 if (files.contract) data.append("contract", files.contract);
 files.governmentIds.forEach(f => data.append("governmentIds", f));
 files.otherDocuments.forEach(f => data.append("otherDocuments", f));

 // Also append draftId if completing a draft
 if (draftId) {
 data.append("draftId", draftId);
 }

 const res = await api.post('/employees', data, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });

 const created = res.data?.data;
 setCreatedEmployee(created);
 setOnboardingWarnings(Array.isArray(res.data?.warnings) ? res.data.warnings : []);
 setIsSuccess(true);

 if (created?.accountCreated) {
 toast.success("Employee onboarded and HRISense account created.");
 } else {
 toast.success("Employee record created.");
 }
 } catch (error: any) {
 console.error(error);
 toast.error(getApiErrorMessage(error, "Failed to create employee"));
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleCopy = () => {
 if (!createdEmployee?.temporaryPassword) return;
 const loginId = createdEmployee.accountEmail || createdEmployee.personalEmail;
 const text = `HRISense login\nLogin ID: ${loginId}\nTemporary Password: ${createdEmployee.temporaryPassword}`;
 navigator.clipboard.writeText(text);
 toast.success("Credentials copied to clipboard");
 };

 /**
  * Builds the one-time credential sheet as a real PDF document.
  *
  * This used to rasterise the success card with html2pdf/html2canvas. That
  * approach clones the whole card into a temporary full-screen container; when
  * the clone step threw, the promise rejected with nothing awaiting it and the
  * container was left in the document — an invisible layer over the page that
  * swallowed every click, which is why the buttons stopped responding after a
  * download. Nothing is cloned here: the document is written directly, so there
  * is no overlay to leave behind, and the whole operation is wrapped in
  * try/finally so the button always returns to normal.
  */
 const handleDownloadPDF = async () => {
 if (isGeneratingPdf || !createdEmployee) return;
 setIsGeneratingPdf(true);
 try {
 const employeeName = `${createdEmployee.firstName ?? ''} ${createdEmployee.lastName ?? ''}`.trim() || 'Employee';
 const employeeNumber = createdEmployee.employeeNumber ?? '';
 const loginId = createdEmployee.accountEmail || createdEmployee.personalEmail || '';
 const tempPassword = createdEmployee.temporaryPassword;

 const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
 const marginX = 64;
 let y = 84;

 doc.setFont('helvetica', 'bold');
 doc.setFontSize(20);
 doc.text('HSJ HRISense', marginX, y);

 y += 22;
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(11);
 doc.setTextColor(90);
 doc.text('Employee Login Credentials', marginX, y);

 y += 26;
 doc.setDrawColor(200);
 doc.line(marginX, y, 612 - marginX, y);

 const row = (label: string, value: string) => {
 y += 30;
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(10);
 doc.setTextColor(110);
 doc.text(label.toUpperCase(), marginX, y);
 y += 16;
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(13);
 doc.setTextColor(20);
 doc.text(value || '—', marginX, y);
 };

 row('Employee Name', employeeName);
 row('Employee Number', employeeNumber);
 if (loginId) row('Login ID', loginId);
 if (tempPassword) row('Temporary Password', tempPassword);

 y += 40;
 doc.setDrawColor(200);
 doc.line(marginX, y, 612 - marginX, y);

 y += 26;
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 doc.setTextColor(150, 70, 10);
 doc.text('Change this password on first login.', marginX, y);

 y += 20;
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(9.5);
 doc.setTextColor(110);
 doc.text(
 doc.splitTextToSize(
 'Keep this sheet secure and hand it to the employee directly. HRISense staff will never ask for a password.',
 612 - marginX * 2
 ),
 marginX,
 y
 );

 doc.save(`HRISense_Credentials_${employeeNumber || 'employee'}.pdf`);
 toast.success('Credential sheet downloaded.');
 } catch (error) {
 console.error('Failed to generate the credential PDF', error);
 toast.error('The credential PDF could not be generated. Use Copy Credentials instead.');
 } finally {
 setIsGeneratingPdf(false);
 }
 };

 if (isLoading) {
 return (
 <div className="p-6 max-w-screen-lg mx-auto min-h-[50vh] flex flex-col items-center justify-center">
 <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
 <p className="text-muted-foreground">Loading master data...</p>
 </div>
 );
 }

 if (hasError) {
 return (
 <div className="p-6 max-w-screen-lg mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center">
 <div className="bg-status-danger-surface p-6 rounded-lg max-w-md">
 <h2 className="text-xl font-bold text-status-danger-foreground mb-2">Employee Onboarding could not be loaded.</h2>
 <p className="text-status-danger-foreground mb-4">There was a problem fetching the required organizational master data. Please try again.</p>
 {import.meta.env.DEV && errorDetails && (
 <pre className="text-xs text-status-danger-foreground bg-status-danger-surface/50 p-3 rounded text-left overflow-auto max-h-40 mb-6 font-mono">
 Error Details: {errorDetails}
 </pre>
 )}
 <div className="flex gap-4 justify-center">
 <Button variant="outline" onClick={fetchDropdownsAndDraft}>Retry</Button>
 <Button onClick={() => navigate({ to: "/employees", search: {} as any })}>Return to Employee Directory</Button>
 </div>
 </div>
 </div>
 );
 }

 if (!units.length && !departments.length && !jobRoles.length) {
 return (
 <div className="p-6 max-w-screen-lg mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center">
 <div className="bg-status-warning-surface p-6 rounded-lg max-w-md">
 <h2 className="text-xl font-bold text-status-warning-foreground mb-2">Master Data Missing</h2>
 <p className="text-status-warning-foreground mb-6">Units, Departments, Job Roles, or Work Schedules are not available. Configure organizational master data before onboarding an employee.</p>
 <Button onClick={() => navigate({ to: "/employees", search: {} as any })}>Return to Employee Directory</Button>
 </div>
 </div>
 );
 }

 if (isSuccess) {
 return (
 <div className="p-6 max-w-screen-md mx-auto min-h-[80vh] flex flex-col items-center justify-center">
 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
 <div className="bg-input-background p-8 rounded-xl border border-gray-100 shadow-sm text-center dark:border-border-soft">
 <div className="mx-auto w-20 h-20 bg-success-light text-success rounded-full flex items-center justify-center mb-6">
 <CheckCircle2 className="h-10 w-10" />
 </div>
 <h1 className="text-3xl font-bold text-foreground mb-2">Onboarding Complete</h1>
 <p className="text-muted-foreground mb-8">
 {createdEmployee?.accountCreated
 ? "The employee record and HRISense login account have been created."
 : "The employee record has been created."}
 </p>

 <div className="bg-surface-2 p-6 rounded-lg text-left max-w-md mx-auto space-y-4">
 <div>
 <span className="text-sm text-muted-foreground block">Employee Name</span>
 <span className="font-semibold text-foreground text-lg">{createdEmployee?.firstName} {createdEmployee?.lastName}</span>
 </div>
 <div>
 <span className="text-sm text-muted-foreground block">Employee Number</span>
 <span className="font-mono text-foreground">{createdEmployee?.employeeNumber}</span>
 </div>
 {createdEmployee?.accountCreated && (
 <div>
 <span className="text-sm text-muted-foreground block">Login ID</span>
 <span className="font-mono text-foreground">{createdEmployee?.accountEmail}</span>
 </div>
 )}
 {typeof createdEmployee?.documentsSaved === 'number' && (
 <div>
 <span className="text-sm text-muted-foreground block">Documents Saved</span>
 <span className="font-semibold text-foreground">{createdEmployee.documentsSaved}</span>
 </div>
 )}
 {createdEmployee?.temporaryPassword ? (
 <div className="bg-status-warning-surface border border-status-warning-border p-3 rounded mt-4">
 <span className="text-xs text-status-warning-foreground font-semibold uppercase tracking-wider block mb-1">Temporary Password</span>
 <span className="font-mono font-bold text-lg text-foreground tracking-wider">{createdEmployee.temporaryPassword}</span>
 <p className="text-xs text-status-warning-foreground mt-2">
 This temporary password is shown once and is never stored in readable form. Save it now or give it to the employee. They must change it at first sign-in.
 </p>
 </div>
 ) : (
 <div className="bg-muted border border-border p-3 rounded mt-4">
 <p className="text-xs text-muted-foreground">
 No temporary password was issued for this employee.
 </p>
 </div>
 )}
 {createdEmployee?.accountCreated && (
 <div className={`p-3 rounded border text-xs ${createdEmployee?.emailSent ? 'bg-success-light border-success/30 text-success-dark' : 'bg-warning-light border-warning/40 text-warning-dark'}`}>
 {createdEmployee?.emailMessage
 || (createdEmployee?.emailSent
 ? `Welcome email sent to ${createdEmployee?.emailRecipient || createdEmployee?.personalEmail}.`
 : 'The welcome email was not sent. Give the credentials to the employee directly.')}
 </div>
 )}
 </div>
 </div>

 {onboardingWarnings.length > 0 && (
 <div className="mt-6 max-w-md mx-auto rounded-xl border border-warning/40 bg-warning-light p-4 text-left">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle className="h-4 w-4 text-warning-dark" />
 <p className="text-sm font-bold text-warning-dark">Needs your attention</p>
 </div>
 <ul className="list-disc pl-5 space-y-1">
 {onboardingWarnings.map((w, i) => (
 <li key={i} className="text-xs text-warning-dark">{w}</li>
 ))}
 </ul>
 </div>
 )}

 {/* Wraps on narrow screens instead of forcing three buttons onto one line. */}
 <div className="flex flex-wrap justify-center gap-3 mt-8">
 <Button variant="subtle" onClick={handleCopy} disabled={!createdEmployee?.temporaryPassword}>
 <Copy /> Copy Credentials
 </Button>
 <Button variant="subtle" onClick={handleDownloadPDF} disabled={isGeneratingPdf}>
 {isGeneratingPdf ? <Loader2 className="animate-spin" /> : <Download />}
 {isGeneratingPdf ? 'Preparing PDF...' : 'Download PDF'}
 </Button>
 <Button variant="solid" onClick={() => navigate({ to: "/employees", search: {} as any })}>
 Go to Directory <ArrowRight />
 </Button>
 </div>
 </motion.div>
 </div>
 );
 }

 return (
 <div className="p-6 max-w-screen-lg mx-auto space-y-6 pb-24">
 <div className="border-b border-primary-200/50 pb-4 dark:border-primary-900/50">
 <PageHeader
 icon={<UserPlus className="h-5 w-5" />}
 title="Employee Onboarding"
 subtitle="Follow the steps to fully enroll a new employee into HRISense."
 badgeText="New Registration"
 actions={
 <div className="flex flex-wrap gap-2 items-center">
 <HelpLink slug="onboard-new-employee" />
 <Button variant="outline" size="sm" onClick={handleReturn} className="h-9 px-4 border-border text-foreground hover:bg-muted font-semibold">
 <ArrowLeft className="h-4 w-4" /> Return to Directory
 </Button>
 </div>
 } />
 </div>

 <div className="mb-8 overflow-x-auto pb-6 scrollbar-hide">
 <div className="flex items-center min-w-[700px] relative">
 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full"></div>
 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-600 -z-10 rounded-full transition-all duration-300" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}></div>
 {STEPS.map((step, index) => {
 const isCompleted = index < currentStep;
 const isActive = index === currentStep;
 return (
 <div key={index} ref={(el) => { stepRefs.current[index] = el; }} className="flex-1 min-w-[120px] flex flex-col items-center gap-2 relative">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors duration-300 ${isCompleted ? 'bg-primary-600 border-primary-600 ' : isActive ? 'bg-primary-50 border-primary-600 text-primary-700 shadow-sm dark:bg-primary-900/40 dark:text-primary-300' : 'bg-surface border-border text-muted-foreground'}`}>
 {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
 </div>
 <span className={`text-[11px] uppercase tracking-wider text-center max-w-[80px] ${isActive ? 'font-bold text-primary-700 dark:text-primary-300' : isCompleted ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{step}</span>
 </div>
 );
 })}
 </div>
 </div>

 <div className="hrisense-surface overflow-hidden">
 <div className="p-6 sm:p-10">
 
 {currentStep === 0 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <UserPlus className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Personal Information</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Enter the employee's basic identifying information.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="md:col-span-3">
 <label className="block text-sm font-medium text-foreground mb-1">Profile Picture (Optional)</label>
 <div className="flex items-center gap-4 p-4 border-2 border-dashed border-border rounded-xl hover:border-primary-400 hover:bg-surface-2 transition-colors">
 {files.profilePicture ? (
 <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-border">
 <img src={URL.createObjectURL(files.profilePicture)} alt="Preview" className="h-full w-full object-cover" />
 <button type="button" onClick={() => setFiles(prev => ({...prev, profilePicture: null}))} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-xs font-semibold">Remove</button>
 </div>
 ) : (
 <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground border-2 border-border">
 <User className="h-8 w-8" />
 </div>
 )}
 <div className="flex-1">
 <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'profilePicture')} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer dark:file:bg-primary-900/40 dark:file:text-primary-300 dark:hover:file:bg-primary-900/60" />
 <p className="text-xs text-muted-foreground mt-2">JPEG or PNG. Max size 5MB.</p>
 </div>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">First Name *</label>
 <input required name="firstName" value={formData.firstName} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Middle Name</label>
 <input name="middleName" value={formData.middleName} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Last Name *</label>
 <input required name="lastName" value={formData.lastName} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Suffix</label>
 <input name="suffix" value={formData.suffix} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Sex *</label>
 <select required name="gender" value={formData.gender} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 {/* A draft from an applicant who left sex blank opens on this prompt. */}
 <option value="" disabled>Select…</option>
 <option value="MALE">Male</option>
 <option value="FEMALE">Female</option>
 <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Date of Birth *</label>
 <input required type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Place of Birth</label>
 <input name="placeOfBirth" value={formData.placeOfBirth} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Civil Status *</label>
 <select required name="civilStatus" value={formData.civilStatus} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 {/* A draft from a hired applicant has no civil status (applicants are never asked). */}
 <option value="" disabled>Select…</option>
 <option value="SINGLE">Single</option>
 <option value="MARRIED">Married</option>
 <option value="WIDOWED">Widowed</option>
 <option value="SEPARATED">Separated</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Nationality</label>
 <input name="nationality" value={formData.nationality} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Religion</label>
 {/* Pick from the list, or choose "Others" and write it in. */}
 <ReligionPicker
 value={formData.religion}
 onChange={(religion) => setFormData(prev => ({ ...prev, religion }))}
 controlClass="hrisense-control w-full h-[42px] px-3"
 otherPlaceholder="Please specify the religion"
 />
 </div>
 {/* Optional — blank means not provided. */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Blood Type</label>
 <select name="bloodType" value={formData.bloodType} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="">Not provided</option>
 {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Number of Children</label>
 <input type="number" min={0} max={30} step={1} inputMode="numeric" name="numberOfChildren" value={formData.numberOfChildren} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Leave blank if not provided; 0 is a valid answer.</p>
 </div>
 {formData.civilStatus && formData.civilStatus !== "SINGLE" && (
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Spouse Name</label>
 <input name="spouseName" value={formData.spouseName} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 )}
 </div>
 </div>
 )}

 {currentStep === 1 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Contact Information</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Provide the employee's contact details and addresses. The personal email is the HRISense login.</p>
 </div>

 <div className="rounded-xl border border-info-200 dark:border-info-800/60 bg-info-50/70 dark:bg-info-950/30 p-4">
 <p className="text-sm font-semibold text-info-950 dark:text-info-100">One email address</p>
 <p className="text-xs md:text-sm text-info-800/90 dark:text-info-200/80 leading-relaxed mt-0.5">
 The <strong>personal email</strong> is the employee's HRISense login ID, and the welcome message with the temporary password is sent to it. It cannot already be another account's login.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Personal Email (login) *</label>
 <input required type="email" name="personalEmail" value={formData.personalEmail} onChange={handleChange} placeholder="name@gmail.com" className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Used to sign in to HRISense; the temporary password is sent here.</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Mobile Number *</label>
 <input required name="mobilePhone" value={formData.mobilePhone} onChange={handleChange} placeholder="09XXXXXXXXX" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Telephone Number</label>
 <input name="telephoneNumber" value={formData.telephoneNumber} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 </div>

 <div className="grid grid-cols-1 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Present Address *</label>
 <textarea required name="presentAddress" value={formData.presentAddress} onChange={handleChange} rows={2} className="hrisense-control w-full px-3 py-2" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Permanent / Provincial Address</label>
 <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} rows={2} className="hrisense-control w-full px-3 py-2" />
 <p className="text-xs text-muted-foreground mt-1">Leave blank if the same as the present address.</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">HSJ Residence</label>
 <input name="hsjResidence" value={formData.hsjResidence} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Only if the employee lives at Hospicio.</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Unit / Dorm</label>
 <input name="residenceDorm" value={formData.residenceDorm} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Where they stay — not their work unit.</p>
 </div>
 </div>
 </div>
 )}

 {currentStep === 2 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <Briefcase className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Employment Information</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Configure job role, organizational placement, and schedule.</p>
 </div>
 <div className="bg-surface-2 p-4 rounded-xl border border-border">
 <OrgSelector
 unitId={formData.unitId}
 departmentId={formData.departmentId}
 jobRoleId={formData.jobRoleId}
 onChange={({ unitId, departmentId, jobRoleId }) => {
 setFormData(prev => ({
 ...prev,
 unitId,
 departmentId,
 jobRoleId,
 supervisorId: "", // Clear supervisor preview on org change
 // A different placement means a different automatic result; HR re-decides.
 supervisorOverrideId: "",
 supervisorOverrideReason: "",
 }));
 setOverrideOpen(false);
 }}
 unitRequired={true}
 roleRequired={true}
 layout="grid"
 />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Resolved Supervisor (Automatic)</label>
 <div className="w-full px-3 py-2 border rounded-md bg-surface-2 text-foreground min-h-[38px] flex items-center">
 {isResolvingSupervisor ? (
 <span className="text-muted-foreground text-sm flex items-center gap-2">
 <Loader2 className="h-4 w-4 animate-spin" /> Resolving...
 </span>
 ) : supervisorPreview?.supervisor ? (
 <span className="font-medium">
 {supervisorPreview.supervisor.firstName} {supervisorPreview.supervisor.lastName} ({supervisorPreview.supervisor.jobRole?.title})
 </span>
 ) : supervisorPreview?.assignmentStatus === 'PENDING' ? (
 <span className="text-status-warning-foreground text-sm font-medium">
 Pending HR Review ({supervisorPreview.pendingReason?.replace(/_/g, ' ') || 'No active supervisor'})
 </span>
 ) : (
 <span className="text-muted-foreground text-sm">{supervisorPreview?.noSupervisorRequired ? 'No supervisor required (top-level role)' : 'No supervisor required (Head)'}</span>
 )}
 </div>
 {!overrideOpen ? (
 <button type="button" onClick={() => setOverrideOpen(true)} disabled={!formData.jobRoleId} className="mt-2 text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50 dark:text-primary-300">
 Change Supervisor
 </button>
 ) : (
 <div className="mt-3 space-y-3 rounded-xl border border-status-warning-border bg-status-warning-surface/50 p-3">
 <p className="text-xs font-semibold text-status-warning-foreground">HR override — replaces the automatic result above</p>
 <div>
 <label htmlFor="supervisorOverrideId" className="block text-xs font-medium text-foreground mb-1">Supervisor</label>
 <select id="supervisorOverrideId" name="supervisorOverrideId" value={formData.supervisorOverrideId} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="">Select an active employee…</option>
 {eligibleSupervisors.map((e: any) => (
 <option key={e.id} value={e.id}>{e.lastName}, {e.firstName} — {e.jobRole?.title ?? 'No job role'}{e.unit?.name ? ` · ${e.unit.name}` : ''}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="supervisorOverrideReason" className="block text-xs font-medium text-foreground mb-1">Reason {formData.supervisorOverrideId ? '*' : ''}</label>
 <textarea id="supervisorOverrideReason" name="supervisorOverrideReason" rows={2} value={formData.supervisorOverrideReason} onChange={handleChange} placeholder="Why the automatic supervisor is being replaced" className="hrisense-control w-full px-3 py-2" />
 </div>
 <button type="button" onClick={() => { setOverrideOpen(false); setFormData(prev => ({ ...prev, supervisorOverrideId: "", supervisorOverrideReason: "" })); }} className="text-xs font-semibold text-muted-foreground hover:underline">
 Use the automatic result instead
 </button>
 </div>
 )}
 </div>
 <div className="md:col-span-2 rounded-xl border border-border bg-surface-2 p-4">
 <p className="text-sm font-medium text-foreground">Leave eligibility (set by HR)</p>
 <p className="text-xs text-muted-foreground mt-0.5">Paternity and Solo Parent leave are granted automatically only when HR marks the employee eligible here. HRISense never infers eligibility from sex, civil status or any other field.</p>
 <div className="mt-3 flex flex-wrap gap-6">
 <label className="inline-flex items-center gap-2 text-sm text-foreground">
 <input type="checkbox" checked={formData.paternityLeaveEligible} onChange={(e) => { setIsDirty(true); setFormData(prev => ({ ...prev, paternityLeaveEligible: e.target.checked })); }} className="h-4 w-4" />
 Eligible for Paternity Leave
 </label>
 <label className="inline-flex items-center gap-2 text-sm text-foreground">
 <input type="checkbox" checked={formData.soloParentLeaveEligible} onChange={(e) => { setIsDirty(true); setFormData(prev => ({ ...prev, soloParentLeaveEligible: e.target.checked })); }} className="h-4 w-4" />
 Eligible for Solo Parent Leave
 </label>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Schedule Template *</label>
 <select required name="scheduleTemplateId" value={formData.scheduleTemplateId} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="">Select a Schedule Template...</option>
 {scheduleTemplates.map(t => (
   <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Employment Status *</label>
 <select required name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="REGULAR">Regular</option>
 <option value="PROBATIONARY">Probationary</option>
 <option value="CONTRACTUAL">Contractual</option>
 <option value="CASUAL">Casual</option>
 <option value="PART_TIME">Part-Time</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Employee Status *</label>
 <select required name="employmentState" value={formData.employmentState} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="ACTIVE">Active</option>
 <option value="ON_LEAVE">On Leave</option>
 {ENDING_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Start Date *</label>
 <input required type="date" name="hireDate" value={formData.hireDate} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Regularization Date</label>
 <input type="date" name="regularizationDate" value={formData.regularizationDate} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 {/* Only for an employment that has already ended (AWOL / Resigned / Retired / Terminated / Others). */}
 {hasEnded(formData.employmentState) && (
 <>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">End Date *</label>
 <input required type="date" name="separationDate" min={formData.hireDate || undefined} value={formData.separationDate} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Employment ended on this date; it cannot be earlier than the start date.</p>
 </div>
 <div className={formData.employmentState === 'OTHERS' ? '' : 'hidden'}>
 <label className="block text-sm font-medium text-foreground mb-1">Specific Reason *</label>
 <input required={formData.employmentState === 'OTHERS'} name="separationReason" value={formData.separationReason} onChange={handleChange} placeholder="State the reason" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {currentStep === 3 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <Shield className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Government Numbers</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Provide statutory identification numbers.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">SSS Number</label>
 <input name="sssNumber" value={formData.sssNumber} onChange={handleChange} placeholder="00-0000000-0" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">PhilHealth Number</label>
 <input name="philhealthNumber" value={formData.philhealthNumber} onChange={handleChange} placeholder="00-000000000-0" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Pag-IBIG Number</label>
 <input name="pagibigNumber" value={formData.pagibigNumber} onChange={handleChange} placeholder="0000-0000-0000" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">TIN Number</label>
 <input name="tinNumber" value={formData.tinNumber} onChange={handleChange} placeholder="000-000-000-000" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 {/* Anything the four numbers above do not cover — as many rows as needed. */}
 <div className="md:col-span-2">
 <p className="block text-sm font-medium text-foreground mb-2">Other Government IDs</p>
 <GovernmentIdRowsEditor
 value={formData.otherGovernmentIdRows}
 onChange={(rows) => { setIsDirty(true); setFormData(prev => ({ ...prev, otherGovernmentIdRows: rows })); }}
 />
 </div>
 </div>
 </div>
 )}

 {currentStep === 4 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Emergency Contacts</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Who to notify in case of an emergency — up to three people. The first is required.</p>
 </div>
 <EmergencyContactsEditor
 value={formData.emergencyContacts}
 onChange={(rows) => { setIsDirty(true); setFormData(prev => ({ ...prev, emergencyContacts: rows })); }}
 />
 </div>
 )}

 {currentStep === 5 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <BookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Education & Licenses</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">All optional. Fill in what applies — PRC and NC only for roles that hold them. Copies go in Document Uploads.</p>
 </div>

 <div>
 <h3 className="text-sm font-bold text-foreground mb-3">Professional license (PRC)</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">PRC License #</label>
 <input name="prcLicenseNumber" value={formData.prcLicenseNumber} onChange={handleChange} placeholder="For licensed professionals only" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Profession</label>
 <input name="professionalRole" value={formData.professionalRole} onChange={handleChange} placeholder="e.g. Registered Nurse" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 {formData.prcLicenseNumber.trim() && (
 <>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Issued</label>
 <input type="date" name="prcIssuedDate" value={formData.prcIssuedDate} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Valid Until</label>
 <input type="date" name="prcValidUntil" value={formData.prcValidUntil} min={formData.prcIssuedDate || undefined} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 </>
 )}
 </div>
 </div>

 <div>
 <h3 className="text-sm font-bold text-foreground mb-3">National certificate (TESDA)</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Certificate Number</label>
 <input name="ncCertificateNumber" value={formData.ncCertificateNumber} onChange={handleChange} placeholder="e.g. NC II certificate number" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Qualification</label>
 <input name="ncQualification" value={formData.ncQualification} onChange={handleChange} placeholder="e.g. Caregiving NC II" className="hrisense-control w-full h-[42px] px-3" />
 </div>
 {formData.ncCertificateNumber.trim() && (
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Valid Until</label>
 <input type="date" name="ncValidUntil" value={formData.ncValidUntil} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 <p className="text-xs text-muted-foreground mt-1">Only if the certificate states one.</p>
 </div>
 )}
 </div>
 </div>

 <div>
 <h3 className="text-sm font-bold text-foreground mb-3">Education</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Primary School</label>
 <input name="primarySchool" value={formData.primarySchool} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Secondary School</label>
 <input name="secondarySchool" value={formData.secondarySchool} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Tertiary School</label>
 <input name="tertiarySchool" value={formData.tertiarySchool} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Course</label>
 <input name="tertiaryCourse" value={formData.tertiaryCourse} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Graduated</label>
 <select name="tertiaryGraduated" value={formData.tertiaryGraduated} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3">
 <option value="">Not recorded</option>
 <option value="true">Yes</option>
 <option value="false">No</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-foreground mb-1">Diploma</label>
 <input name="diploma" value={formData.diploma} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-foreground mb-1">Vocational Qualification</label>
 <input name="vocationalQualification" value={formData.vocationalQualification} onChange={handleChange} className="hrisense-control w-full h-[42px] px-3" />
 </div>
 </div>
 </div>
 </div>
 )}

 {currentStep === 6 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Document Uploads</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Uploading documents is optional during onboarding. You may upload them later.</p>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="border border-dashed rounded-xl p-6 text-center hover:bg-surface-2 transition-colors">
 <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
 <label className="block text-sm font-medium text-foreground mb-1">Resume / CV</label>
 <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, 'resume')} className="text-sm mt-2 max-w-[220px] mx-auto text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
 </div>
 <div className="border border-dashed rounded-xl p-6 text-center hover:bg-surface-2 transition-colors">
 <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
 <label className="block text-sm font-medium text-foreground mb-1">Employment Contract</label>
 <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileChange(e, 'contract')} className="text-sm mt-2 max-w-[220px] mx-auto text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
 </div>
 </div>
 <div className="border border-dashed rounded-xl p-6 hover:bg-surface-2 transition-colors">
 <div className="flex items-center gap-4 mb-4">
 <FileText className="h-8 w-8 text-muted-foreground" />
 <div>
 <label className="block text-sm font-medium text-foreground">Government IDs & Clearances</label>
 <p className="text-xs text-muted-foreground">Upload multiple files if needed</p>
 </div>
 </div>
 <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileChange(e, 'governmentIds', true)} className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
 {files.governmentIds.length > 0 && (
 <ul className="mt-4 space-y-2">
 {files.governmentIds.map((f, i) => (
 <li key={i} className="text-sm text-muted-foreground flex justify-between items-center bg-input-background p-2 border rounded">
 <span className="truncate">{f.name}</span>
 <button type="button" onClick={() => setFiles(prev => ({...prev, governmentIds: prev.governmentIds.filter((_, idx) => idx !== i)}))} className="text-status-danger-foreground hover:text-status-danger-foreground">Remove</button>
 </li>
 ))}
 </ul>
 )}
 </div>
 </div>
 )}

 {currentStep === 7 && (
 <div className="space-y-6">
 <div className="border-b border-border pb-4 mb-6">
 <div className="flex items-center gap-2">
 <CheckCircle2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
 <h2 className="text-xl font-bold text-foreground font-heading">Review & Confirm</h2>
 </div>
 <p className="text-sm text-muted-foreground mt-1">Verify the details before finalizing the onboarding process.</p>
 </div>
 <div className="bg-surface-2 rounded-lg p-6 border space-y-6">
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 text-sm">
 <div>
 <span className="text-muted-foreground block mb-1">Full Name</span>
 <span className="font-medium">{formData.firstName} {formData.middleName} {formData.lastName} {formData.suffix}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Personal Email (login)</span>
 <span className="font-medium">{formData.personalEmail || '-'}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Unit</span>
 <span className="font-medium">{units.find(u => u.id === formData.unitId)?.name || '-'}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Department</span>
 <span className="font-medium">{units.find(u => u.id === formData.unitId)?.department?.name || '-'}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Job Role</span>
 <span className="font-medium">{jobRoles.find(r => r.id === formData.jobRoleId)?.title || '-'}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Immediate Supervisor</span>
 <span className="font-medium">
 {/*
   Reads the same shape the Employment step renders. This used to read
   `supervisorPreview.supervisorName`, a property the resolve endpoint never
   returns, so the review screen showed a blank supervisor even when
   resolution had succeeded and the saved record was correct.
 */}
 {formData.supervisorOverrideId
   ? (() => {
       const chosen = eligibleSupervisors.find((e: any) => e.id === formData.supervisorOverrideId);
       return `${chosen ? `${chosen.firstName} ${chosen.lastName}` : 'Selected supervisor'} — changed by HR (${formData.supervisorOverrideReason || 'no reason given'})`;
     })()
   : supervisorPreview?.supervisor
   ? `${supervisorPreview.supervisor.firstName} ${supervisorPreview.supervisor.lastName}${
       supervisorPreview.supervisor.jobRole?.title
         ? ` (${supervisorPreview.supervisor.jobRole.title})`
         : ''
     }`
   : supervisorPreview?.assignmentStatus === 'PENDING'
     ? `Pending HR Review (${supervisorPreview.pendingReason?.replace(/_/g, ' ') || 'No active supervisor'})`
     : supervisorPreview?.noSupervisorRequired ? 'No supervisor required (top-level role)' : 'No supervisor required (Head)'}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Employment Status</span>
 <span className="font-medium">{formData.employmentStatus.replace('_', ' ')}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Employee Status</span>
 <span className="font-medium">{EMPLOYMENT_STATE_LABELS[formData.employmentState as EmploymentState] || formData.employmentState.replace('_', ' ')}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Start Date</span>
 <span className="font-medium">{formatEmploymentDate(formData.hireDate)}</span>
 </div>
 {hasEnded(formData.employmentState) && (
 <div>
 <span className="text-muted-foreground block mb-1">End Date</span>
 <span className="font-medium">{formatEmploymentDate(formData.separationDate)}</span>
 </div>
 )}
 {formData.employmentState === 'OTHERS' && (
 <div>
 <span className="text-muted-foreground block mb-1">Specific Reason</span>
 <span className="font-medium">{formData.separationReason || '-'}</span>
 </div>
 )}
 {formData.prcLicenseNumber && (
 <div>
 <span className="text-muted-foreground block mb-1">PRC License #</span>
 <span className="font-medium">{formData.prcLicenseNumber}{formData.professionalRole ? ` — ${formData.professionalRole}` : ''}</span>
 {formData.prcValidUntil && (
 <span className="block text-xs text-muted-foreground mt-0.5">
 Valid until {formatEmploymentDate(formData.prcValidUntil)} · {credentialValidity(formData.prcValidUntil)?.label}
 </span>
 )}
 </div>
 )}
 {formData.ncCertificateNumber && (
 <div>
 <span className="text-muted-foreground block mb-1">National Certificate</span>
 <span className="font-medium">{formData.ncCertificateNumber}{formData.ncQualification ? ` — ${formData.ncQualification}` : ''}</span>
 {formData.ncValidUntil && (
 <span className="block text-xs text-muted-foreground mt-0.5">Valid until {formatEmploymentDate(formData.ncValidUntil)}</span>
 )}
 </div>
 )}
 {/* Optional record fields: shown only when filled in. */}
 {[
 ['Blood Type', formData.bloodType],
 ['Spouse Name', formData.civilStatus !== 'SINGLE' ? formData.spouseName : ''],
 ['Number of Children', formData.numberOfChildren],
 ['HSJ Residence', [formData.hsjResidence, formData.residenceDorm].filter(Boolean).join(' · ')],
 ['Education', [formData.tertiaryCourse, formData.tertiarySchool, graduatedLabel(formData.tertiaryGraduated) ? `Graduated: ${graduatedLabel(formData.tertiaryGraduated)}` : ''].filter(Boolean).join(' · ')],
 ['Diploma / Vocational', [formData.diploma, formData.vocationalQualification].filter(Boolean).join(' · ')],
 ].filter(([, v]) => String(v ?? '').trim() !== '').map(([label, v]) => (
 <div key={label}>
 <span className="text-muted-foreground block mb-1">{label}</span>
 <span className="font-medium">{v}</span>
 </div>
 ))}
 <div>
 <span className="text-muted-foreground block mb-1">Mobile Number</span>
 <span className="font-medium">{formData.mobilePhone || '-'}</span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Emergency Contacts</span>
 <ul className="font-medium space-y-0.5">
 {filledContacts(formData.emergencyContacts).map((c, i) => (
 <li key={i}>{i + 1}. {c.contactName} ({c.relationship}) · {c.mobilePhone}</li>
 ))}
 </ul>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Other Government IDs</span>
 <span className="font-medium">
 {filledGovernmentIds(formData.otherGovernmentIdRows).length
 ? filledGovernmentIds(formData.otherGovernmentIdRows).map((g) => `${g.idType}: ${g.idNumber}`).join(' · ')
 : 'None'}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Leave Eligibility</span>
 <span className="font-medium">
 {[formData.paternityLeaveEligible && 'Paternity Leave', formData.soloParentLeaveEligible && 'Solo Parent Leave'].filter(Boolean).join(', ') || 'Not marked'}
 </span>
 </div>
 <div>
 <span className="text-muted-foreground block mb-1">Present Address</span>
 <span className="font-medium">{formData.presentAddress || '-'}</span>
 </div>
 </div>

 <div className="p-3 bg-info-50 dark:bg-info-950/30 border border-info-200 dark:border-info-800/60 rounded text-sm text-info-900 dark:text-info-100">
 On finalise, HRISense generates the employee number automatically (HSJ-XXXX), creates the login account for the email above, and issues a one-time temporary password.
 </div>

 {supervisorPreview?.assignmentStatus === 'PENDING' && !formData.supervisorOverrideId && (
 <div className="p-3 bg-status-warning-surface border border-status-warning-border rounded text-sm text-status-warning-foreground">
 <strong>Warning:</strong> Supervisor assignment is pending and will require HR review. The employee will still be onboarded.
 </div>
 )}
 <div className="pt-4 border-t">
 <span className="text-muted-foreground block mb-2 text-sm">Uploaded Documents</span>
 <ul className="text-sm font-medium space-y-1">
 {files.profilePicture && <li>Profile Picture</li>}
 {files.resume && <li>Resume</li>}
 {files.contract && <li>Employment Contract</li>}
 {files.governmentIds.length > 0 && <li>{files.governmentIds.length} Government IDs</li>}
 {!files.profilePicture && !files.resume && !files.contract && files.governmentIds.length === 0 && <li className="text-muted-foreground font-normal">No documents uploaded.</li>}
 </ul>
 </div>

 </div>

 {/* Email Preview */}
 <div className="bg-input-background border rounded-lg overflow-hidden mt-6">
 <div className="bg-surface-2 border-b px-4 py-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Eye className="h-4 w-4 text-muted-foreground" />
 <span className="text-sm font-medium text-foreground">Welcome Email Preview</span>
 </div>
 <span className="text-xs text-muted-foreground">Sent after the employee is created</span>
 </div>
 <div className="p-6">
 <div className="mb-4">
 <p className="text-sm text-muted-foreground"><strong>To:</strong> {formData.personalEmail || '[Personal Email]'} <span className="text-xs italic">(the employee's personal email)</span></p>
 <p className="text-sm text-muted-foreground"><strong>Subject:</strong> Welcome to HRISense — Your Login Credentials</p>
 </div>
 <div className="border-t pt-4 text-sm text-gray-800 space-y-4 font-serif dark:text-foreground">
 <p>Dear {formData.firstName || '[First Name]'},</p>
 <p>Welcome to Hospicio de San Jose!</p>
 <p>Your employee record and HRISense account have been created. You can sign in using the following credentials:</p>
 <div className="bg-surface-2 p-3 rounded font-mono text-sm border">
 <p><strong>Employee Number:</strong> <span className="text-muted-foreground text-xs italic">(generated on creation)</span></p>
 <p><strong>Login ID:</strong> {formData.personalEmail || '[Personal Email]'}</p>
 <p><strong>Password:</strong> ************ <span className="text-muted-foreground text-xs italic">(securely generated on creation)</span></p>
 </div>
 <p>You must change this temporary password the first time you sign in.</p>
 <p>Keep these credentials private. HRISense staff will never ask you for your password.</p>
 <p>Best regards,<br/>HR Department<br/>Hospicio de San Jose</p>
 </div>
 </div>
 </div>
 <p className="text-sm text-muted-foreground">
 Click"Confirm & Onboard Employee" to generate the employee number and create the user account. A temporary password will be securely generated.
 </p>
 </div>
 )}

 </div>
 
 <div className="bg-surface-2 px-6 py-4 sm:px-8 border-t border-border flex justify-between items-center">
 <Button variant="outline" onClick={prevStep} disabled={currentStep === 0 || isSubmitting} className="h-[42px] px-6 text-[14px] font-semibold border-border text-foreground hover:bg-muted w-full sm:w-auto transition-colors">
 <ArrowLeft className="h-4 w-4" /> Back
 </Button>
 <div className="flex gap-3">
 <Button variant="update" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting} className="h-[42px] px-5 text-[14px] font-semibold border-border transition-colors">
 {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-primary-600 dark:text-primary-300" />}
 Save as Draft
 </Button>
 {currentStep < STEPS.length - 1 ? (
 <Button onClick={nextStep} className="h-[42px] px-6 text-[14px] font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-all">
 Next Step <ArrowRight className="h-4 w-4" />
 </Button>
 ) : (
 <Button onClick={handleSubmit} disabled={isSubmitting} className="h-[42px] px-6 text-[14px] font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-all">
 {isSubmitting ?"Processing..." :"Confirm & Onboard"}
 </Button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
