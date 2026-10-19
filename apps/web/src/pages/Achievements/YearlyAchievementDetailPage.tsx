import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProtectedImage } from "@/components/ui/ProtectedImage";
import { LoadError } from "@/components/shared/LoadError";
import { useAuth } from "@/providers/AuthProvider";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { AchievementsService, type AchievementEntry, type AchievementPage } from "@/services/achievements.service";

/**
 * One year's achievements. Everyone reads a published page; HR edits the
 * introduction, adds / edits / reorders / removes achievements (each with an
 * optional image or PDF), publishes or unpublishes, and deletes the page.
 */
export default function YearlyAchievementDetailPage() {
  const { pageId } = useParams({ strict: false }) as { pageId: string };
  const { user } = useAuth();
  const isHr = user?.permissionTier === "FULL";
  const navigate = useNavigate();
  const [page, setPage] = useState<AchievementPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingPage, setEditingPage] = useState(false);
  const [draft, setDraft] = useState({ title: "", summary: "", year: "" });
  const [editingEntry, setEditingEntry] = useState<string | "new" | null>(null);

  const load = useCallback(() => {
    setError(null);
    AchievementsService.get(pageId).then(setPage).catch((err) => setError(getApiErrorMessage(err, "This page could not be loaded.")));
  }, [pageId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<AchievementPage | void>, ok: string) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next) setPage(next);
      toast.success(ok);
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The change could not be saved."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="p-6 max-w-4xl mx-auto"><LoadError message={error} onRetry={load} /></div>;
  if (!page) return <p className="p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</p>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={"/achievements" as any} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> All years
        </Link>
        {isHr && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => { setDraft({ title: page.title, summary: page.summary ?? "", year: String(page.year) }); setEditingPage(true); }}>
              <Pencil className="h-4 w-4" /> Edit page
            </Button>
            <Button size="sm" variant={page.status === "PUBLISHED" ? "outline" : "create"} className="gap-1" disabled={busy}
              onClick={() => run(() => AchievementsService.update(page.id, { status: page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), page.status === "PUBLISHED" ? "Unpublished — only HR can see it now." : "Published — every employee can see it.")}>
              {page.status === "PUBLISHED" ? <><EyeOff className="h-4 w-4" /> Unpublish</> : <><Eye className="h-4 w-4" /> Publish</>}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1 text-status-danger-foreground" disabled={busy}
              onClick={async () => {
                if (!(await confirmAction({ title: `Delete the ${page.year} page?`, message: "All of its achievements are deleted with it.", confirmLabel: "Delete", danger: true }))) return;
                if (await run(() => AchievementsService.remove(page.id), "Page deleted.")) navigate({ to: "/achievements" as any });
              }}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <header className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
        <div className="bg-gradient-to-br from-primary-600 to-primary-400 px-6 py-8 text-white">
          <p className="text-6xl font-extrabold font-heading tracking-tight tabular-nums">{page.year}</p>
          {editingPage ? (
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Title" className="mt-2 w-full rounded-lg bg-white/95 px-3 py-2 text-lg font-bold text-foreground" />
          ) : (
            <h1 className="mt-1 text-2xl font-bold">{page.title}</h1>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase">
            {page.isSample && <span className="rounded-full bg-white/90 px-2 py-0.5 text-primary-800">Sample content</span>}
            {page.status === "DRAFT" && <span className="rounded-full bg-status-warning-surface px-2 py-0.5 text-status-warning-foreground">Draft — visible to HR only</span>}
          </div>
        </div>
        <div className="p-6">
          {editingPage ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold">Introduction / summary</span>
                <textarea rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold">Year</span>
                <input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} className="h-9 w-28 rounded-lg border border-border bg-background px-2" />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingPage(false)}>Cancel</Button>
                <Button size="sm" disabled={busy} onClick={async () => { if (await run(() => AchievementsService.update(page.id, { title: draft.title, summary: draft.summary, year: Number(draft.year) }), "Page saved.")) setEditingPage(false); }}>Save</Button>
              </div>
            </div>
          ) : page.summary ? (
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{page.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{isHr ? "No introduction yet — select Edit page to add one." : ""}</p>
          )}
        </div>
      </header>

      <section aria-labelledby="achievements-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="achievements-heading" className="text-lg font-bold text-foreground font-heading">Achievements</h2>
          {isHr && editingEntry !== "new" && <Button size="sm" className="gap-1" onClick={() => setEditingEntry("new")}><Plus className="h-4 w-4" /> Add achievement</Button>}
        </div>

        {isHr && editingEntry === "new" && (
          <EntryForm
            busy={busy}
            onCancel={() => setEditingEntry(null)}
            onSave={async (title, description, file) => { if (await run(() => AchievementsService.addEntry(page.id, title, description, file), "Achievement added.")) setEditingEntry(null); }}
          />
        )}

        {page.entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No achievements on this page yet.</p>
        ) : (
          <ol className="space-y-4">
            {page.entries.map((e, i) =>
              editingEntry === e.id ? (
                <li key={e.id}>
                  <EntryForm
                    entry={e}
                    busy={busy}
                    onCancel={() => setEditingEntry(null)}
                    onSave={async (title, description, file, removeAttachment) => {
                      if (await run(() => AchievementsService.updateEntry(e.id, { title, description, removeAttachment }, file), "Achievement saved.")) setEditingEntry(null);
                    }}
                  />
                </li>
              ) : (
                <li key={e.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-base font-bold text-foreground">{e.title}</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{e.description}</p>
                      {e.attachment?.isImage && (
                        <ProtectedImage src={AchievementsService.attachmentPath(e.id)} alt={e.title} className="max-h-80 w-auto rounded-xl border border-border object-contain" />
                      )}
                      {e.attachment && !e.attachment.isImage && (
                        <Button size="xs" variant="outline" className="gap-1" onClick={() => AchievementsService.openAttachment(e.id).catch((err) => toast.error(getApiErrorMessage(err, "The file could not be opened.")))}>
                          <FileText className="h-3.5 w-3.5" /> {e.attachment.name ?? "Open document"}
                        </Button>
                      )}
                    </div>
                    {isHr && (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={busy || i === 0} onClick={() => run(() => AchievementsService.moveEntry(e.id, "up"), "Moved.")}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={busy || i === page.entries.length - 1} onClick={() => run(() => AchievementsService.moveEntry(e.id, "down"), "Moved.")}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Edit" disabled={busy} onClick={() => setEditingEntry(e.id)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Remove" className="text-status-danger-foreground" disabled={busy}
                          onClick={async () => { if (await confirmAction({ title: `Remove “${e.title}”?`, confirmLabel: "Remove", danger: true })) void run(() => AchievementsService.deleteEntry(e.id), "Achievement removed."); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            )}
          </ol>
        )}
      </section>
    </div>
  );
}

function EntryForm({ entry, busy, onCancel, onSave }: {
  entry?: AchievementEntry;
  busy: boolean;
  onCancel: () => void;
  onSave: (title: string, description: string, file: File | null, removeAttachment?: boolean) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-primary-300 bg-surface p-5 dark:border-primary-800">
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-semibold">Title <span className="text-status-danger-foreground">*</span></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-semibold">Description <span className="text-status-danger-foreground">*</span></span>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="space-y-1">
          <span className="block font-semibold">Image or PDF (optional, up to 5 MB)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {entry?.attachment && !file && (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={removeAttachment} onChange={(e) => setRemoveAttachment(e.target.checked)} /> Remove the current file ({entry.attachment.name})
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={busy || !title.trim() || !description.trim()} onClick={() => onSave(title, description, file, removeAttachment)}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save achievement
        </Button>
      </div>
    </div>
  );
}
