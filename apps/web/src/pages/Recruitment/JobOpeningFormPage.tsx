import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, CalendarDays, Eye, FileText, Plus, Save, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { RecruitmentService, JobOpening, CreateJobOpeningPayload } from "@/services/recruitment.service";
import { api } from "@/services/api";
import { usePermission } from "@/hooks/usePermission";
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { NewPositionDialog, type RoleOption } from "./components/NewPositionDialog";

const FIELD = "w-full h-10 px-3 text-sm bg-surface border border-input rounded-lg focus:ring-2 focus:ring-primary-500/20 outline-none";
const AREA = "w-full px-3 py-2 text-sm bg-surface border border-input rounded-lg focus:ring-2 focus:ring-primary-500/20 outline-none resize-y";

const EMPLOYMENT_TYPES: Array<[string, string]> = [
  ["REGULAR", "Regular"],
  ["PROBATIONARY", "Probationary"],
  ["CONTRACTUAL", "Contractual"],
  ["CASUAL", "Casual"],
  ["PART_TIME", "Part-Time"],
];

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground font-heading">{icon}{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-foreground">{label}{required && <span className="text-status-danger-foreground"> *</span>}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * Create / edit a Job Opening. The position is chosen from Hospicio's CURRENT
 * job roles (the role's unit and department fill in); "+ New position" adds a
 * job role only when none fits, refusing near-duplicate titles. The posting
 * title starts as the role's title and can be adjusted for applicants. Save,
 * publish and status rules are unchanged.
 */
export default function JobOpeningFormPage() {
  const { openingId } = useParams({ strict: false });
  const isEditing = Boolean(openingId);
  const navigate = useNavigate();
  const { hasPermission, tier } = usePermission();
  const canPublish = tier === "FULL" || hasPermission("recruitment", "publish");

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<JobOpening | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [newPositionOpen, setNewPositionOpen] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const [formData, setFormData] = useState<CreateJobOpeningPayload>({
    title: "",
    unitId: "",
    departmentId: "",
    jobRoleId: "",
    employmentType: "REGULAR",
    vacancies: 1,
    description: "",
    responsibilities: "",
    qualifications: "",
    requiredDocuments: "",
    openingDate: new Date().toISOString().split("T")[0],
    closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  // The CURRENT job roles and units — never a list typed into the page.
  useEffect(() => {
    Promise.all([api.get("/employees/job-roles"), api.get("/employees/units")])
      .then(([r, u]) => {
        setRoles(((r.data?.data ?? []) as any[]).map((x) => ({ id: x.id, title: x.title, unitId: x.unitId ?? null, departmentId: x.departmentId ?? null })));
        setUnits(u.data?.data ?? []);
      })
      .catch((err) => toast.error(getApiErrorMessage(err, "Positions and units could not be loaded.")));
  }, []);

  useEffect(() => {
    if (!formData.unitId) return setDepartments([]);
    api.get("/departments", { params: { unitId: formData.unitId } }).then((r) => setDepartments(r.data?.data ?? [])).catch(() => setDepartments([]));
  }, [formData.unitId]);

  useEffect(() => {
    if (isEditing && openingId) {
      const fetchOpening = async () => {
        try {
          const opening = await RecruitmentService.getJobOpeningById(openingId);
          setInitialData(opening);
          setTitleTouched(true);
          setFormData({
            title: opening.title,
            unitId: opening.unitId,
            departmentId: opening.departmentId || "",
            jobRoleId: opening.jobRoleId,
            employmentType: opening.employmentType,
            vacancies: opening.vacancies ?? 1,
            description: opening.description,
            responsibilities: opening.responsibilities,
            qualifications: opening.qualifications,
            requiredDocuments: opening.requiredDocuments || "",
            openingDate: new Date(opening.openingDate).toISOString().split("T")[0],
            closingDate: new Date(opening.closingDate).toISOString().split("T")[0],
          });
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Failed to load job opening"));
          navigate({ to: "/recruitment/openings" });
        } finally {
          setLoading(false);
        }
      };
      fetchOpening();
    }
  }, [isEditing, openingId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "title") setTitleTouched(true);
    setFormData((prev) => ({
      ...prev,
      [name]: name === "vacancies" ? parseInt(value) || 1 : value,
    }));
  };

  /** Choosing a position fills in its unit and department, and the posting title. */
  const selectRole = (roleId: string, pool: RoleOption[] = roles) => {
    const role = pool.find((r) => r.id === roleId);
    setFormData((prev) => ({
      ...prev,
      jobRoleId: roleId,
      unitId: role?.unitId ?? (role ? prev.unitId : ""),
      departmentId: role?.departmentId ?? "",
      title: !titleTouched || !prev.title ? role?.title ?? "" : prev.title,
    }));
  };

  const selectedRole = roles.find((r) => r.id === formData.jobRoleId) ?? null;
  const orgWideRole = Boolean(selectedRole && !selectedRole.unitId);
  const unitName = units.find((u) => u.id === formData.unitId)?.name ?? "";
  const rolesByUnit = useMemo(() => {
    const groups = new Map<string, RoleOption[]>();
    for (const r of [...roles].sort((a, b) => a.title.localeCompare(b.title))) {
      const key = units.find((u) => u.id === r.unitId)?.name ?? "Organisation-wide";
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [roles, units]);

  const handleSubmit = async (publish: boolean) => {
    if (!formData.jobRoleId) {
      toast.error("Choose the position (job role) for this opening.");
      return;
    }
    if (!formData.title || !formData.unitId || !formData.description || !formData.responsibilities || !formData.qualifications) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (new Date(formData.closingDate) < new Date(formData.openingDate)) {
      toast.error("Closing date must be after or equal to opening date");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { ...formData };
      if (!payload.departmentId) {
        delete payload.departmentId;
      }
      if (!payload.requiredDocuments) {
        delete payload.requiredDocuments;
      }

      let savedId = openingId;
      if (isEditing && openingId) {
        await RecruitmentService.updateJobOpening(openingId, payload);
        toast.success("Job opening updated successfully");
      } else {
        const created = await RecruitmentService.createJobOpening(payload);
        savedId = created.id;
        toast.success("Job opening created successfully");
      }

      if (publish && savedId) {
        if (window.confirm("Are you sure you want to publish this opening? It will become publicly visible on the Careers portal if the dates are valid.")) {
          await RecruitmentService.changeJobOpeningStatus(savedId, "OPEN");
          toast.success("Job opening published successfully");
        }
      }

      navigate({ to: `/recruitment/openings/${savedId}` });
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "An error occurred while saving"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <p className="text-muted-foreground">Loading form...</p>
      </div>
    );
  }

  const typeLabel = EMPLOYMENT_TYPES.find(([v]) => v === formData.employmentType)?.[1] ?? formData.employmentType;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/recruitment/openings" })} aria-label="Back to job openings">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground font-heading">{isEditing ? "Edit Job Opening" : "Create Job Opening"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEditing && initialData ? `Reference ${initialData.referenceNumber} · ${initialData.status}` : "A vacancy for an existing position. It stays a draft until you publish it."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5 min-w-0">
          <Section icon={<Briefcase className="h-4.5 w-4.5 text-primary-600 dark:text-primary-300" />} title="Position" hint="Choose the position from Hospicio's current job roles. Its unit and department fill in.">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 min-w-0">
                <Field label="Job Role / Position" required>
                  <select value={formData.jobRoleId} onChange={(e) => selectRole(e.target.value)} className={FIELD}>
                    <option value="">Select position…</option>
                    {rolesByUnit.map(([unit, list]) => (
                      <optgroup key={unit} label={unit}>
                        {list.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              </div>
              <Button type="button" variant="outline" onClick={() => setNewPositionOpen(true)} className="gap-1 shrink-0">
                <Plus className="h-4 w-4" /> New position
              </Button>
            </div>

            <Field label="Posting title" required hint="What applicants see. It starts as the position's title; adjust it only if the posting needs more detail.">
              <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Choose a position first" className={FIELD} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {orgWideRole || !selectedRole ? (
                <Field label="Unit" required hint={orgWideRole ? "This position is organisation-wide; choose the unit for this vacancy." : undefined}>
                  <select name="unitId" value={formData.unitId} onChange={(e) => setFormData((p) => ({ ...p, unitId: e.target.value, departmentId: "" }))} className={FIELD} disabled={!selectedRole}>
                    <option value="">{selectedRole ? "Select the unit…" : "Choose a position first"}</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Unit">
                  <p className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground">{unitName || "—"}</p>
                </Field>
              )}
              <Field label="Department (optional)">
                <select name="departmentId" value={formData.departmentId || ""} onChange={handleChange} className={FIELD} disabled={!formData.unitId || departments.length === 0}>
                  <option value="">{departments.length ? "None" : "No departments in this unit"}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section icon={<CalendarDays className="h-4.5 w-4.5 text-primary-600 dark:text-primary-300" />} title="Vacancy" hint="Applicants can apply only while the opening is published and between these dates.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Employment Type" required>
                <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={FIELD}>
                  {EMPLOYMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Vacancies" required>
                <input type="number" name="vacancies" value={formData.vacancies} onChange={handleChange} min="1" className={FIELD} />
              </Field>
              <Field label="Opening Date" required>
                <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} className={FIELD} />
              </Field>
              <Field label="Closing Date" required>
                <input type="date" name="closingDate" value={formData.closingDate} onChange={handleChange} min={formData.openingDate} className={FIELD} />
              </Field>
            </div>
          </Section>

          <Section icon={<FileText className="h-4.5 w-4.5 text-primary-600 dark:text-primary-300" />} title="Posting content" hint="Shown on the opening's Careers page.">
            <Field label="Description" required>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Brief overview of the role..." className={AREA} />
            </Field>
            <Field label="Responsibilities" required>
              <textarea name="responsibilities" value={formData.responsibilities} onChange={handleChange} rows={4} placeholder="List of key duties..." className={AREA} />
            </Field>
            <Field label="Qualifications" required>
              <textarea name="qualifications" value={formData.qualifications} onChange={handleChange} rows={4} placeholder="Required skills, education, and experience..." className={AREA} />
            </Field>
            <Field label="Required Documents (optional)">
              <textarea name="requiredDocuments" value={formData.requiredDocuments} onChange={handleChange} rows={2} placeholder="e.g., Resume, Transcript of Records..." className={AREA} />
            </Field>
          </Section>
        </div>

        {/* How it will look on Careers */}
        <aside className="lg:sticky lg:top-4 h-fit space-y-3">
          <div className="rounded-2xl border border-primary-200 bg-surface p-4 shadow-card dark:border-primary-800">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Careers preview</p>
            <h3 className="mt-2 text-lg font-bold text-foreground break-words">{formData.title || "Posting title"}</h3>
            {selectedRole && selectedRole.title !== formData.title && <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">{selectedRole.title}</p>}
            <p className="text-sm text-muted-foreground">{unitName || "Unit"}{formData.departmentId ? ` · ${departments.find((d) => d.id === formData.departmentId)?.name ?? ""}` : ""}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {typeLabel}</p>
              <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {formData.vacancies} vacanc{formData.vacancies === 1 ? "y" : "ies"}</p>
              <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formData.openingDate} → closes {formData.closingDate}</p>
            </div>
          </div>
          <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Careers lists only published (Open) openings between their opening and closing dates. Drafts, closed, filled and archived openings are never shown.
          </p>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 border-t border-border bg-background/95 px-4 sm:px-6 py-3 backdrop-blur">
        <Button variant="outline" onClick={() => navigate({ to: "/recruitment/openings" })} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={submitting} className="gap-2">
          <Save className="h-4 w-4" />
          {isEditing ? "Save Changes" : "Save as Draft"}
        </Button>
        {(!isEditing || initialData?.status === "DRAFT") && canPublish && (
          <Button variant="create" onClick={() => handleSubmit(true)} disabled={submitting} className="gap-2 shadow-pop-color">
            <Send className="h-4 w-4" />
            Save & Publish
          </Button>
        )}
      </div>

      <NewPositionDialog
        open={newPositionOpen}
        onOpenChange={setNewPositionOpen}
        roles={roles}
        units={units}
        onUseExisting={(id) => selectRole(id)}
        onCreated={(role) => {
          const next = [...roles, role];
          setRoles(next);
          selectRole(role.id, next);
        }}
      />
    </div>
  );
}
