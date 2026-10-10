import { api } from '@/services/api';

/**
 * Downloads a file from an authenticated HRISense stream route.
 *
 * Protected documents are never served statically — they stream through routes
 * that require a bearer token. A plain `<a href>` cannot supply that header, so
 * anchor-based downloads fail with 401. This fetches the file through the axios
 * client (which attaches the token and handles refresh), then hands the browser
 * a blob to save.
 *
 * @param path   API path relative to VITE_API_URL, e.g. `/medical/documents/<id>/stream`
 * @param filename Suggested filename for the saved file.
 */
export async function downloadProtectedFile(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Opens a protected file in a new tab (preview) instead of saving it. */
export async function openProtectedFile(path: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });
  const contentType = res.headers['content-type'];
  const url = window.URL.createObjectURL(
    new Blob([res.data], typeof contentType === 'string' ? { type: contentType } : undefined)
  );
  window.open(url, '_blank', 'noopener,noreferrer');
  // The tab needs the URL to stay alive briefly after opening.
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
