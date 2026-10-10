import { Users, X, Building2, Briefcase, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AudiencePreviewEmployee } from '@/services/announcement.service';
import { cn } from '@/lib/utils';

interface AudiencePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRecipients: number;
  previewEmployees: AudiencePreviewEmployee[];
}

export function AudiencePreviewModal({
  open,
  onOpenChange,
  totalRecipients,
  previewEmployees,
}: AudiencePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[min(680px,calc(100vw-32px))] sm:max-w-[min(680px,calc(100vw-32px))]',
          'h-[min(580px,calc(100vh-64px))] max-h-[min(580px,calc(100vh-64px))]',
          'flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Audience Preview
                </h2>
                <Badge variant="outline" className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-primary-900">
                  {totalRecipients} {totalRecipients === 1 ? 'Recipient' : 'Recipients'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sample preview of active employees who match this audience
              </p>
            </div>
          </div>
          {/* No close button here: DialogContent already renders one, and a
              second copy showed up as two ✕ in the corner. */}
        </div>

        {/* List of sample employees */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {previewEmployees.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-muted-foreground">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No employees match the selected audience
              </p>
              <p className="text-xs text-slate-500 mt-1 dark:text-muted-foreground">
                Please adjust your audience targeting selection.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {previewEmployees.map((emp) => (
                  <div
                    key={emp.employeeId}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {emp.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {emp.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        <Briefcase className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{emp.jobRole?.title || 'Staff'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono text-muted-foreground dark:text-slate-500">
                          {emp.employeeNumber}
                        </span>
                        <span>•</span>
                        <span className="truncate">
                          {emp.department?.name || emp.unit?.name || 'HSJ'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalRecipients > previewEmployees.length && (
                <div className="p-3 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 mt-3">
                  + {totalRecipients - previewEmployees.length} more active eligible employees will receive this announcement.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 text-status-success-foreground font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Live verified audience snapshot
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
