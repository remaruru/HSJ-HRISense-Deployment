import { useEffect, useState } from 'react';
import { BadgeCheck, Copy, Edit2, FileText, Loader2, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EvaluationService, type EvaluationTemplate } from '@/services/evaluation.service';
import { RatingScaleList, WeightTotalChip } from './RatingScale';
import { getApiErrorMessage } from '@/utils/error-handler.util';

/** "OFFICIAL · Hospicio de San Jose" or "CUSTOM". */
export function TemplateOriginBadge({ template }: { template: Pick<EvaluationTemplate, 'isOfficial'> }) {
  return template.isOfficial ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary-300 bg-primary-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-800 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Official · Hospicio de San Jose
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Custom</span>
  );
}

/** How a template's overall score is reached, in plain words. */
export function scoringExplanation(t: EvaluationTemplate): string {
  const layout = t.formLayout ?? {};
  const areas = t.groups?.length ?? 0;
  if (t.ratingMethod !== 'NUMERIC') return 'No numeric score — answers are labels or written assessments.';
  if (t.scoringMethod === 'AREA_AVERAGE') {
    return layout.weightsSource === 'FORM_FORMULA'
      ? `The form's own rule: each factor's total ÷ ${t.criteria && areas ? Math.round(t.criteria.length / areas) : 'its statements'} = its average; the sum of the ${areas} averages ÷ ${areas} = the overall rating.`
      : `Each review area's average, then the average of the ${areas} area averages.`;
  }
  if (t.scoringMethod === 'AREA_WEIGHTED') {
    const base = `Each review area's average × the area's weight ÷ 100, added up across ${areas} areas.`;
    return layout.weightsSource === 'HRISENSE_EQUAL'
      ? `${base} The paper form prints no weights, so HRISense uses an equal split. To use other weights, duplicate it as a custom template.`
      : base;
  }
  return t.useWeighting ? 'Σ rating × criterion weight ÷ 100.' : 'The average of the ratings given.';
}

interface Props {
  template: EvaluationTemplate | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a duplicate is created (e.g. to open it for editing). */
  onDuplicated: (copy: EvaluationTemplate) => void;
  onEdit: (template: EvaluationTemplate) => void;
  onChanged: () => void;
}

/**
 * Read-only view of a template. Official Hospicio forms can be used and
 * duplicated as custom templates, never edited — only which job roles use them
 * can change (that is configuration, not the form's content).
 */
export function EvaluationTemplateViewer({ template, onOpenChange, onDuplicated, onEdit, onChanged }: Props) {
  const [full, setFull] = useState<EvaluationTemplate | null>(template);
  const [duplicating, setDuplicating] = useState(false);
  const [editingRoles, setEditingRoles] = useState(false);
  const [roles, setRoles] = useState<Array<{ id: string; title: string; unit?: { name: string } | null }>>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    setFull(template);
    setEditingRoles(false);
    // The list already carries the summary; the full form (criteria) loads here.
    if (template) {
      EvaluationService.getTemplate(template.id)
        .then(setFull)
        .catch((err) =>
          toast.error(getApiErrorMessage(err, 'The full template could not be loaded. Close and reopen it to try again.'), {
            id: 'template-viewer',
          })
        );
    }
  }, [template]);

  const t = full;
  if (!template || !t) return null;
  const layout = t.formLayout ?? {};
  const groups = t.groups ?? [];
  const marker = layout.itemMarker ?? ')';

  const duplicate = async () => {
    setDuplicating(true);
    try {
      const copy = await EvaluationService.duplicateTemplate(t.id);
      toast.success(`“${copy.name}” created. Edit it as you need — the original stays unchanged.`);
      onChanged();
      onDuplicated(copy);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Could not duplicate the template.'));
    } finally {
      setDuplicating(false);
    }
  };

  const startRoles = async () => {
    setRoleIds((t.jobRoles ?? []).map((j) => j.jobRoleId));
    setEditingRoles(true);
    try {
      const res = await api.get('/job-roles');
      setRoles(res.data?.data || []);
    } catch {
      setRoles([]);
    }
  };

  const saveRoles = async () => {
    setSavingRoles(true);
    try {
      const updated = await EvaluationService.setTemplateJobRoles(t.id, roleIds);
      setFull(updated);
      setEditingRoles(false);
      toast.success('Job roles updated.');
      onChanged();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Could not update the job roles.'));
    } finally {
      setSavingRoles(false);
    }
  };

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <TemplateOriginBadge template={t} />
            {!t.isActive && <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-bold uppercase text-muted-foreground">Inactive</span>}
          </div>
          <DialogTitle className="flex items-center gap-2 pt-1">
            <FileText className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-300" aria-hidden="true" />
            {t.name}
          </DialogTitle>
          <DialogDescription>{t.description || 'Evaluation template'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {t.isOfficial && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-3 text-xs text-foreground dark:border-primary-900 dark:bg-primary-950/20 space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-primary-800 dark:text-primary-200">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Official form — read-only
              </p>
              <p>Source document: <span className="font-medium">{t.sourceDocument}</span>{layout.formCode && layout.formCode !== 'Simplified' ? ` (${layout.formCode})` : ''}.</p>
              {layout.appliesTo?.length ? <p>Hospicio uses it for: <span className="font-medium">{layout.appliesTo.join(', ')}</span>.</p> : null}
              <p className="text-muted-foreground">To change its wording, statements, scale or weights, use “Duplicate as Custom”. The official version is never altered.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <section className="rounded-xl border border-border p-3">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rating Scale</h3>
              <RatingScaleList template={t} order="desc" />
            </section>
            <section className="rounded-xl border border-border p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall score</h3>
              <p className="text-xs text-foreground">{scoringExplanation(t)}</p>
              {t.scoringMethod === 'AREA_WEIGHTED' && <WeightTotalChip weights={groups.map((g) => g.weight)} />}
            </section>
          </div>

          <section className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Job roles evaluated with it
              </h3>
              {!editingRoles && (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={startRoles}>Change job roles</Button>
              )}
            </div>
            {!editingRoles ? (
              <p className="mt-1.5 text-xs text-foreground">
                {t.jobRoles?.length ? t.jobRoles.map((j) => j.jobRole.title).join(', ') : 'None — used only when a cycle selects it.'}
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-muted-foreground">A job role uses one template; a role already on another template must be removed there first.</p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted/40">
                      <input type="checkbox" checked={roleIds.includes(r.id)} onChange={(e) => setRoleIds((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} />
                      <span className="min-w-0 flex-1">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.unit?.name ?? 'Organisation-wide'}</span>
                    </label>
                  ))}
                  {!roles.length && <p className="px-3 py-2 text-xs text-muted-foreground">Loading job roles…</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRoles(false)}>Cancel</Button>
                  <Button type="button" size="sm" onClick={saveRoles} disabled={savingRoles}>
                    {savingRoles && <Loader2 className="h-4 w-4 animate-spin" />} Save job roles
                  </Button>
                </div>
              </div>
            )}
          </section>

          {layout.instructions?.length ? (
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground">Instructions printed on the form</summary>
              <div className="mt-2 space-y-1 text-xs text-foreground">
                {layout.instructions.map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </details>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {groups.length ? `${groups.length} review areas · ${t.criteria?.length ?? 0} statements` : `${t.criteria?.length ?? 0} criteria`}
            </h3>
            {groups.length ? (
              <div className="space-y-2">
                {groups.map((g, gi) => {
                  const items = (t.criteria ?? []).filter((c) => c.groupId === g.id);
                  return (
                    <details key={g.id} className="rounded-xl border border-border bg-surface" open={gi === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                        <span className="min-w-0 font-semibold text-foreground">
                          {gi + 1}. {g.name} <span className="font-normal text-xs text-muted-foreground">· {items.length} statements</span>
                        </span>
                        {t.scoringMethod === 'AREA_WEIGHTED' && g.weight !== null && g.weight !== undefined && (
                          <span className="shrink-0 rounded-full border border-status-accent-border bg-status-accent-surface px-2 py-0.5 text-xs font-bold text-status-accent-foreground">{g.weight}%</span>
                        )}
                      </summary>
                      <ol className="space-y-1.5 border-t border-border-soft px-3 py-2.5">
                        {items.map((c, ci) => (
                          <li key={c.id} className="flex gap-2 text-sm text-foreground">
                            <span className="w-5 shrink-0 font-semibold text-muted-foreground">{String.fromCharCode(97 + ci)}{marker}</span>
                            <span>{c.name}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  );
                })}
              </div>
            ) : (
              <ol className="space-y-1.5">
                {(t.criteria ?? []).map((c, i) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                    <span className="text-foreground"><span className="font-semibold">{i + 1}. {c.name}</span>{c.description && <span className="block text-xs text-muted-foreground mt-0.5">{c.description}</span>}</span>
                    {t.useWeighting && c.weight !== null && c.weight !== undefined && <span className="shrink-0 text-xs font-bold text-primary-700 dark:text-primary-300">{c.weight}%</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {(layout.generalCommentsLabel || layout.goalsLabel || layout.acknowledgment || layout.appraisalTypes?.length) && (
            <section className="rounded-xl border border-border p-3 space-y-1.5 text-xs text-foreground">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Written sections</h3>
              <p>Comments on each statement: <span className="font-medium">{layout.itemComments === false ? 'No' : 'Yes'}</span></p>
              {layout.generalCommentsLabel && <p>{layout.generalCommentsLabel}: <span className="text-muted-foreground">free text</span></p>}
              {layout.goalsLabel && <p>{layout.goalsLabel}: <span className="text-muted-foreground">{layout.goalsPrompt}</span></p>}
              {layout.appraisalTypes?.length ? <p>{layout.appraisalLabel ?? 'Appraisal'}: <span className="text-muted-foreground">{layout.appraisalTypes.join(' · ')}</span></p> : null}
              {layout.acknowledgment && <p>Employee acknowledgment: <span className="italic text-muted-foreground">“{layout.acknowledgment}”</span></p>}
            </section>
          )}
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {!t.isOfficial && (
            <Button type="button" variant="update" onClick={() => onEdit(t)} className="gap-1.5">
              <Edit2 className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button type="button" variant={t.isOfficial ? 'primary' : 'outline'} onClick={duplicate} disabled={duplicating} className="gap-1.5">
            {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Duplicate as Custom
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
