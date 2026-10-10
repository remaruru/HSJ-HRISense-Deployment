import { useEffect, useState } from 'react';
import { tokenStorage } from '@/lib/tokenStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Resolves an image reference that may point at a protected HRISense stream route.
 *
 * Protected files (employee photos, documents) are never served statically — they
 * are streamed through authenticated API routes, so a plain `<img src>` cannot
 * load them: the browser will not attach the bearer token. This hook fetches such
 * a path with the token, converts the response into an object URL, and revokes it
 * on unmount.
 *
 * Absolute URLs and data URIs are returned unchanged.
 */
export function useProtectedImageUrl(src?: string | null): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(() =>
    src && isDirectlyLoadable(src) ? src : undefined
  );

  useEffect(() => {
    if (!src) {
      setResolved(undefined);
      return;
    }

    if (isDirectlyLoadable(src)) {
      setResolved(src);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;

    // The session may live in sessionStorage (Remember Me unticked), so the
    // token must come from the shared store rather than localStorage directly.
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setResolved(undefined);
      return;
    }

    const path = src.startsWith('/') ? src : `/${src}`;

    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolved(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return resolved;
}

function isDirectlyLoadable(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:');
}
