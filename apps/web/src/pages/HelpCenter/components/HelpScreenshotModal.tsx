import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { HelpScreenshot } from '../helpCenter.types';

interface HelpScreenshotModalProps {
  screenshot: HelpScreenshot | null;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const HelpScreenshotModal: React.FC<HelpScreenshotModalProps> = ({
  screenshot,
  isOpen,
  onClose,
  triggerRef,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      // Focus modal close button
      setTimeout(() => closeButtonRef.current?.focus(), 50);

      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Return focus to trigger
      triggerRef?.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, triggerRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !screenshot) return null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return createPortal(
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={screenshot.alt || 'Screenshot enlarged view'}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 print:hidden"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-6xl max-h-[92vh] flex flex-col bg-surface dark:bg-slate-900 border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm font-semibold text-foreground truncate max-w-md">
                {screenshot.alt || 'Screenshot preview'}
              </span>
              {screenshot.sensitive && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-status-warning-surface text-status-warning-foreground border border-status-warning-border">
                  Synthetic Demo Data
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Zoom Controls */}
              <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.75}
                  aria-label="Zoom Out"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="px-2 font-mono text-xs font-semibold min-w-12 text-center text-foreground">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 2.5}
                  aria-label="Zoom In"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  aria-label="Reset Zoom"
                  title="Reset Zoom (100%)"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-0.5 border-l border-border"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Close Button */}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close image viewer"
                className="p-2 rounded-xl bg-surface border border-border text-foreground hover:bg-muted hover:text-primary-600 transition-colors ml-2 dark:hover:text-primary-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Image Container with Scroll/Zoom */}
          <div className="relative flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/10 dark:bg-black/40 min-h-[300px]">
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              <img
                src={screenshot.src}
                alt={screenshot.alt || 'Enlarged screenshot'}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg border border-border/80"
              />
            </div>
          </div>

          {/* Caption Footer */}
          {screenshot.caption && (
            <div className="px-5 py-3 border-t border-border bg-surface text-center shrink-0">
              <p className="text-xs md:text-sm font-medium text-foreground/90">
                {screenshot.caption}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
