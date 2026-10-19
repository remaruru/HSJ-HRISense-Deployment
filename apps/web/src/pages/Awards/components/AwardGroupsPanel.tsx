import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, Building2, CheckCircle2, Loader2, Plus, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shared/LoadError";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AwardsService, type AwardGroup } from "@/services/awards.service";
import { OfficialBadge } from "./AwardManager";
import { GroupEditorDialog, type GroupPerson, type GroupRole, type GroupUnit } from "./GroupEditorDialog";

const NEW_GROUP: AwardGroup = {
  id: "", name: "", description: null, isOfficial: false, unitIds: [], departmentIds: [], jobRoleIds: [], employeeIds: [],
  memberCount: 0, hospicioTerms: [], unresolvedTerms: [],
};

/**
 * Award groups: who belongs to Hospicio's four groups (and any custom ones).
 * Set once, reused by every award. HRISense mapped only the Hospicio words that
 * clearly name a current job role; HR adds the rest — nothing is guessed.
 */
export function AwardGroupsPanel() {
  const [groups, setGroups] = useState<AwardGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<GroupRole[]>([]);
  const [units, setUnits] = useState<GroupUnit[]>([]);
  const [people, setPeople] = useState<GroupPerson[]>([]);
  const [editing, setEditing] = useState<AwardGroup | null>(null);

  const load = useCallback(() => {
    setError(null);
    AwardsService.groups().then(setGroups).catch((err) => setError(getApiErrorMessage(err, "Groups could not be loaded.")));
  }, []);
  useEffect(() => {
    load();
    Promise.all([api.get("/employees/job-roles"), api.get("/employees/units"), api.get("/employees", { params: { limit: 1000, isArchived: "false" } })])
      .then(([r, u, e]) => {
        setRoles((r.data?.data ?? []).map((x: any) => ({ id: x.id, title: x.title, unitId: x.unitId ?? null })));
        setUnits((u.data?.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
        setPeople(
          (e.data?.data ?? [])
            .map((x: any) => ({
              id: x.id,
              name: `${x.firstName} ${x.lastName}`.trim(),
              jobRoleId: x.jobRoleId ?? x.jobRole?.id ?? null,
              jobRoleTitle: x.jobRole?.title ?? "",
              unitId: x.unitId ?? x.unit?.id ?? null,
              departmentId: x.departmentId ?? x.department?.id ?? null,
              employmentState: x.employmentState ?? null,
            }))
            .sort((a: GroupPerson, b: GroupPerson) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => toast.error("Job roles, units or employees could not be loaded."));
  }, [load]);

  const names = useMemo(
    () => ({
      role: new Map(roles.map((r) => [r.id, r.title])),
      unit: new Map(units.map((u) => [u.id, u.name])),
      person: new Map(people.map((p) => [p.id, p.name])),
    }),
    [roles, units, people]
  );

  if (error) return <LoadError message={error} onRetry={load} />;
  if (!groups) return <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  const official = groups.filter((g) => g.isOfficial);
  const custom = groups.filter((g) => !g.isOfficial);
  const ready = official.filter((g) => g.memberCount > 0).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground font-heading">What are groups?</h2>
        <p className="text-sm text-muted-foreground">
          Employee of the Quarter and the Vincentian award are voted within Hospicio's four groups: Admin, Social, Pastoral &amp; Homelife, and Health.
          Tell HRISense <strong className="text-foreground">once</strong> who belongs to each group. Every award after that reuses it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-status-success-foreground" style={{ width: `${official.length ? (ready / official.length) * 100 : 0}%` }} />
          </div>
          <p className={cn("text-sm font-semibold", ready === official.length ? "text-status-success-foreground" : "text-foreground")}>
            {ready === official.length ? "All groups are ready." : `${ready} of ${official.length} groups are ready. Add people to the rest.`}
          </p>
        </div>
      </section>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {official.map((g) => <GroupCard key={g.id} group={g} names={names} onEdit={() => setEditing({ ...g })} />)}
      </ul>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">Your own groups</h2>
            <p className="text-xs text-muted-foreground">Only needed for a custom award that should be voted within a group of your own.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing({ ...NEW_GROUP })}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        </div>
        {custom.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {custom.map((g) => <GroupCard key={g.id} group={g} names={names} onEdit={() => setEditing({ ...g })} />)}
          </ul>
        )}
      </section>

      <GroupEditorDialog group={editing} roles={roles} units={units} people={people} onClose={() => setEditing(null)} onSaved={setGroups} />
    </div>
  );
}

const SHOWN = 6;

function GroupCard({
  group: g,
  names,
  onEdit,
}: {
  group: AwardGroup;
  names: { role: Map<string, string>; unit: Map<string, string>; person: Map<string, string> };
  onEdit: () => void;
}) {
  const empty = g.memberCount === 0;
  const chips = [
    ...g.jobRoleIds.map((id) => ({ id, kind: "role" as const, label: names.role.get(id) ?? "Job role" })),
    ...g.unitIds.map((id) => ({ id, kind: "unit" as const, label: names.unit.get(id) ?? "Unit" })),
    ...g.employeeIds.map((id) => ({ id, kind: "person" as const, label: names.person.get(id) ?? "Employee" })),
  ];
  const icon = { role: Briefcase, unit: Building2, person: User };

  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border bg-surface p-4", empty ? "border-status-danger-border" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-foreground">{g.name} <OfficialBadge official={g.isOfficial} /></p>
          {g.isOfficial && <p className="text-xs text-muted-foreground">Used by Employee of the Quarter and the Vincentian award.</p>}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
            empty
              ? "border-status-danger-border bg-status-danger-surface text-status-danger-foreground"
              : "border-status-success-border bg-status-success-surface text-status-success-foreground"
          )}
        >
          {empty ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {empty ? "Nobody yet" : `${g.memberCount} ${g.memberCount === 1 ? "person" : "people"}`}
        </span>
      </div>

      {empty && g.isOfficial && (
        <p className="rounded-xl border border-status-danger-border bg-status-danger-surface px-3 py-2 text-xs text-status-danger-foreground">
          Nobody is in this group, so Employee of the Quarter and the Vincentian award can't start yet. Choose who belongs here.
        </p>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Who is in ${g.name}`}>
          {chips.slice(0, SHOWN).map((c) => {
            const Icon = icon[c.kind];
            return (
              <li key={`${c.kind}-${c.id}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground">
                <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {c.label}
              </li>
            );
          })}
          {chips.length > SHOWN && <li className="rounded-full px-2 py-1 text-xs text-muted-foreground">+{chips.length - SHOWN} more</li>}
        </ul>
      )}

      {g.unresolvedTerms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {g.unresolvedTerms.length === g.hospicioTerms.length ? "Hospicio describes this group as" : "Hospicio also lists"} <span className="text-foreground">{g.unresolvedTerms.join(", ")}</span>. No job role has {g.unresolvedTerms.length === 1 ? "that name" : "those names"}, so choose those people yourself.
        </p>
      )}

      <div className="mt-auto">
        <Button size="sm" variant={empty ? "primary" : "outline"} onClick={onEdit} className="gap-1">
          <Users className="h-4 w-4" /> {empty ? "Choose who's in this group" : "Change who's in it"}
        </Button>
      </div>
    </li>
  );
}
