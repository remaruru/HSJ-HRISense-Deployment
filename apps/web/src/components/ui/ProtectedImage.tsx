import React from 'react';
import { useProtectedImageUrl } from '@/hooks/useProtectedImageUrl';

interface ProtectedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  /** Rendered while the image is loading or when it cannot be shown. */
  fallback?: React.ReactNode;
}

/**
 * `<img>` replacement for references that point at an authenticated HRISense
 * stream route. Falls back to the supplied node when there is no image.
 */
export function ProtectedImage({ src, fallback = null, alt, ...imgProps }: ProtectedImageProps) {
  const resolved = useProtectedImageUrl(src);

  if (!resolved) return <>{fallback}</>;

  return <img src={resolved} alt={alt ?? ''} {...imgProps} />;
}
