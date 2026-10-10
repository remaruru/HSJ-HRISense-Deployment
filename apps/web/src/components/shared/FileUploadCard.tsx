import React, { useRef } from 'react';
import { Upload, Trash2, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadCardProps {
  label?: string;
  helperText?: string;
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  formatsLabel?: string;
}

export function FileUploadCard({
  label = 'Attach Document',
  helperText,
  accept = '.pdf,.png,.jpg,.jpeg,.docx,.doc',
  file,
  onFileChange,
  required = false,
  disabled = false,
  className,
  formatsLabel = 'PDF, JPG, PNG, DOCX (up to 10MB)',
}: FileUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {label} {required ? <span className="text-status-danger-foreground font-bold">*</span> : <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>}
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {helperText || formatsLabel}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const selected = e.target.files?.[0] || null;
          onFileChange(selected);
        }}
        className="hidden"
      />

      {file ? (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/30 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px] sm:max-w-[320px]">
                {file.name}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                ({formatFileSize(file.size)})
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="delete"
            size="sm"
            disabled={disabled}
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="h-8 px-3 text-xs font-semibold shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "px-4 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between gap-3 cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-all group h-12",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Upload className="w-4 h-4 text-slate-500 group-hover:text-teal-600 transition-colors shrink-0 dark:text-muted-foreground dark:group-hover:text-primary-300" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 truncate">
              Click to select a file to upload
            </span>
          </div>
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 shrink-0 hidden sm:inline">
            Browse files
          </span>
        </div>
      )}
    </div>
  );
}
