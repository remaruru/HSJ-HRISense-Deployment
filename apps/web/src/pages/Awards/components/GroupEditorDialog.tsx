import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Briefcase, Building2, Loader2, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasEnded } from "@/lib/employment";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type AwardGroup } from "@/services/awards.service";
import { PillPicker } from "./AwardUi";

export interface GroupRole { id: string; title: string; unitId: string | null }
export interface GroupUnit { id: string; name: string }
export interface GroupPerson {
  id: string;
  name: string;
  jobRoleId: string | null;
  jobRoleTitle: string;
  unitId: string | null;
  departmentId: string | null;
  employmentState: string | null;
}

type Pick = "roles" | "units" | "people";

/**
 * Who belongs to one award group: whole job roles, whole units, and named
 * people. The count at the bottom is worked out from the same rule the server
 * uses, so HR sees who is in before saving.
 */
export function GroupEditorDialog({
  group,
  roles,
  units,
  people,
  onClose,
  onSaved,
}: {
  group: AwardGroup | null;
  roles: GroupRole[];
  units: GroupUnit[];
  people: GroupPerson[];
  onClose: () => void;
  onSaved: (groups: AwardGroup[]) => void;
}) {
  const [draft, setDraft] = useState<AwardGroup | null>(group);
  const [pick, setPick] = useState<Pick>("roles");
  const [showWho, setShowWho] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(group);
    setPick("roles");
    setShowWho(false);
  }, [group]);

  const unitName = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);
  const roleOptions = useMemo(
    () => roles.map((r) => ({ id: r.id, label: r.title, section: r.unitId ? unitName.get(r.unitId) ?? "Other" : "Organisation-wide" }))
      .sort((a, b) => a.section.localeCompare(b.section) || a.label.localeCompare(b.label)),
    [roles, unitName]
  );
  const unitOptions = useMemo(() => units.map((u) => ({ id: u.id, label: u.name })), [units]);
  const personOptions = useMemo(() => people.map((p) => ({ id: p.id, label: p.name, hint: p.jobRoleTitle })), [people]);

  const members = useMemo(() => {
    if (!draft) return [];
    return people.filter(
      (p) =>
        !hasEnded(p.employmentState) &&
        (draft.employeeIds.includes(p.id) ||
          (!!p.jobRoleId && draft.jobRoleIds.includes(p.jobRoleId)) ||
          (!!p.unitId && draft.unitIds.includes(p.unitId)) ||
          (!!p.departmentId && draft.departmentIds.includes(p.departmentId)))
    );
  }, [draft, people]);

  if (!draft) return null;
  const isNew = !draft.id;

  const save = async () => {
    if (isNew && !draft.name.trim()) return toast.error("Give the group a name.");
    setBusy(true);
    try {
      onSaved(await AwardsService.saveGroup(draft.id || null, { ...draft, name: draft.name.trim() }));
      toast.success(isNew ? "Group created." : "Group saved.");
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The group could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the group “${draft.name}”? Awards that already use it keep working, but it can't be picked for new ones.`)) return;
    setBusy(true);
    try {
      onSaved(await AwardsService.deleteGroup(draft.id));
      toast.success("Group deleted.");
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The group could not be deleted."));
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ id: Pick; label: string; icon: ReactNode; count: number }> = [
    { id: "roles", label: "Roles", icon: <Briefcase className="h-4 w-4" />, count: draft.jobRoleIds.length },
    { id: "units", label: "Units", icon: <Building2 className="h-4 w-4" />, count: draft.unitIds.length },
    { id: "people", label: "People", icon: <User className="h-4 w-4" />, count: draft.employeeIds.length },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="pr-8">{isNew ? "New group" : `Who is in “${draft.name}”?`}</DialogTitle>
          <DialogDescription>
            Pick who belongs to this group. Most groups only need <strong>job roles</strong>: everyone with that job role joins. Use whole units or single people for anyone else.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {isNew && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Group name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Night shift staff"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
          )}

          {draft.unresolvedTerms.length > 0 && (
            <p className="rounded-xl border border-status-info-border bg-status-info-surface px-3 py-2 text-xs text-status-info-foreground">
              Hospicio's list for this group {draft.unresolvedTerms.length === draft.hospicioTerms.length ? "says" : "also mentions"} <strong>{draft.unresolvedTerms.join(", ")}</strong>. HRISense has no job role with {draft.unresolvedTerms.length === 1 ? "that name" : "those names"}, so find those people under <em>Roles</em> or <em>People</em> and add them.
            </p>
          )}

          <div role="tablist" aria-label="Add people by" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={pick === t.id}
                onClick={() => setPick(t.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm",
                  pick === t.id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon}
                <span className="truncate">{t.label}</span>
                {t.count > 0 && <span className="rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-white">{t.count}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {pick === "roles" && (
              <PillPicker
                options={roleOptions}
                selected={draft.jobRoleIds}
                onChange={(jobRoleIds) => setDraft({ ...draft, jobRoleIds })}
                searchLabel="Search job roles or units"
              />
            )}
            {pick === "units" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Everyone in a chosen unit joins, whatever their job role.</p>
                <PillPicker
                  options={unitOptions}
                  selected={draft.unitIds}
                  onChange={(unitIds) => setDraft({ ...draft, unitIds })}
                  searchLabel="Search units"
                />
              </div>
            )}
            {pick === "people" && (
              <PillPicker
                options={personOptions}
                selected={draft.employeeIds}
                onChange={(employeeIds) => setDraft({ ...draft, employeeIds })}
                searchLabel="Search by name or job role"
                limit={40}
              />
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary-600 dark:text-primary-300" aria-hidden="true" />
                {members.length === 0 ? "Nobody is in this group yet." : `${members.length} ${members.length === 1 ? "person is" : "people are"} in this group.`}
              </p>
              {members.length > 0 && (
                <button type="button" onClick={() => setShowWho((s) => !s)} className="text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300">
                  {showWho ? "Hide names" : "Show names"}
                </button>
              )}
            </div>
            {showWho && (
              <p className="mt-2 max-h-40 overflow-y-auto text-xs text-foreground">
                {members.map((m) => `${m.name} (${m.jobRoleTitle || "no job role"})`).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            {!isNew && !draft.isOfficial ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={remove} className="gap-1 text-status-danger-foreground">
                <Trash2 className="h-4 w-4" /> Delete group
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {isNew ? "Create group" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
