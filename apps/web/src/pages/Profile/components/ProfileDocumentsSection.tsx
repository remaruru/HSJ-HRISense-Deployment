import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { InfoEmpty, InfoField, InfoList, InfoSection } from '@/components/ui/info-section';
import { api } from '@/services/api';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { downloadProtectedFile, openProtectedFile } from '@/lib/downloadProtectedFile';
import { formatEnumLabel } from '../profileFormat';

interface ProfileDocument {
  id: string;
  category?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
}

const PREVIEWABLE = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function fileSize(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Documents on file, read-only: Preview and Download. Which documents come back
 * is the API's rule (`GET /employees/:id/documents`) — the employee sees their
 * own documents marked visible to them; a supervisor sees a direct report's
 * documents marked visible to the supervisor (never medical clearances). Uploading, editing and deleting stay in
 * Employee Management.
 *
 * `missingItems` are the profile-completion items of this section still to be
 * met (from the API's `missingFieldIds`), listed above the files so the count
 * on the section says what it is counting.
 */
export function ProfileDocumentsSection({
  employeeId,
  description,
  missingCount,
  missingItems = [],
}: {
  employeeId: string;
  description: string;
  missingCount?: number;
  missingItems?: Array<{ label: string; value: string }>;
}) {
  const [docs, setDocs] = useState<ProfileDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/employees/${employeeId}/documents`)
      .then((res) => {
        if (cancelled) return;
        setDocs(Array.isArray(res.data?.data) ? res.data.data : []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDocs([]);
        setError(getApiErrorMessage(err, 'The documents could not be loaded.'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const open = async (doc: ProfileDocument, action: 'preview' | 'download') => {
    setBusy(doc.id);
    try {
      if (action === 'preview') await openProtectedFile(`/documents/${doc.id}/preview`);
      else await downloadProtectedFile(`/documents/${doc.id}/download`, doc.originalFilename?.trim() || `document-${doc.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The file could not be opened.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <InfoSection title="Documents" description={description} missingCount={missingCount}>
      {missingItems.length > 0 && (
        <InfoList className="mb-4">
          {missingItems.map((item) => (
            <InfoField key={item.label} label={item.label} value={item.value} missing />
          ))}
        </InfoList>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : error ? (
        <p className="text-sm text-status-danger-foreground">{error}</p>
      ) : docs.length === 0 ? (
        <InfoEmpty>No documents on file.</InfoEmpty>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {docs.map((doc) => {
            const name = doc.originalFilename?.trim() || 'Unnamed file';
            const uploaded = doc.uploadedAt ? new Date(doc.uploadedAt) : null;
            return (
              <li key={doc.id} className="flex flex-col gap-2 rounded-xl border border-border-soft bg-muted/20 p-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 shrink-0 text-primary-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={name}>{name}</p>
                    <p className="text-xs text-muted-foreground">{doc.category ? formatEnumLabel(doc.category) : 'Uncategorised'}</p>
                    <p className="text-xs text-muted-foreground">
                      {[fileSize(doc.sizeBytes), uploaded && !Number.isNaN(uploaded.getTime()) ? uploaded.toLocaleDateString() : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 border-t border-border pt-2">
                  {doc.mimeType && PREVIEWABLE.includes(doc.mimeType) && (
                    <Button size="sm" variant="review" className="h-8 px-3 text-xs" disabled={busy === doc.id} onClick={() => open(doc, 'preview')}>
                      Preview
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" disabled={busy === doc.id} onClick={() => open(doc, 'download')}>
                    {busy === doc.id ? 'Working…' : 'Download'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </InfoSection>
  );
}
