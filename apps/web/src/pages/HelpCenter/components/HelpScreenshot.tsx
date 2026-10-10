import React, { useRef, useState } from 'react';
import { Maximize2, Shield } from 'lucide-react';
import type { HelpScreenshot as IHelpScreenshot } from '../helpCenter.types';
import { HelpScreenshotModal } from './HelpScreenshotModal';

interface HelpScreenshotProps {
  screenshot?: IHelpScreenshot;
}

export const HelpScreenshot: React.FC<HelpScreenshotProps> = ({ screenshot }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Missing screenshot guard: gracefully render nothing to avoid broken image icons
  if (!screenshot || !screenshot.src) {
    return null;
  }

  return (
    <div className="my-5 space-y-2">
      <div className="group relative rounded-xl border-2 border-border/80 overflow-hidden bg-muted/30 shadow-xs transition-all hover:border-primary-400">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsModalOpen(true)}
          aria-label={`Enlarge screenshot: ${screenshot.alt || 'Step illustration'}`}
          className="relative block w-full text-left cursor-zoom-in focus:outline-hidden focus:ring-4 focus:ring-primary-500/20"
        >
          <img
            src={screenshot.src}
            alt={screenshot.alt || 'Step screenshot illustration'}
            className="w-full h-auto max-h-[480px] object-cover md:object-contain rounded-lg"
          />

          {/* Enlarge Hover Overlay */}
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/80 text-white text-xs font-semibold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 group-hover:bg-primary-600 transition-all shadow-md">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Click to enlarge</span>
          </div>

          {/* Sensitive Data Notice Badge */}
          {screenshot.sensitive && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-warning/90 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-xs">
              <Shield className="h-3 w-3" />
              <span>Synthetic Example Data</span>
            </div>
          )}
        </button>
      </div>

      {/* Caption */}
      {screenshot.caption && (
        <p className="text-xs md:text-sm text-center text-muted-foreground font-medium px-2 leading-normal">
          {screenshot.caption}
        </p>
      )}

      {/* Enlarged Modal Viewer */}
      <HelpScreenshotModal
        screenshot={screenshot}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        triggerRef={triggerRef}
      />
    </div>
  );
};
