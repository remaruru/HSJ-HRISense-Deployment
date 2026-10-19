import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from '@/utils/error-handler.util';

export function SupervisorAssignmentDialog({ 
  isOpen, 
  onClose, 
  employeeId,
  currentSupervisorId,
  onAssignmentSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  employeeId: string;
  currentSupervisorId?: string;
  onAssignmentSuccess: () => void;
}) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedSupervisorId(null);
      setReason("");
      return;
    }
    const searchSupervisors = async () => {
      try {
        const res = await api.get('/employees', {
          params: { search, limit: 10 }
        });
        setEmployees(res.data.data.filter((e: any) => e.id !== employeeId));
        setSearchError(null);
      } catch (error) {
        setEmployees([]);
        setSearchError(getApiErrorMessage(error, "The employee search could not be completed."));
      }
    };
    const timer = setTimeout(searchSupervisors, 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, employeeId]);

  const handleAssign = async () => {
    if (!selectedSupervisorId) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason for this manual override.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/employees/${employeeId}/supervisor-override`, { 
        supervisorId: selectedSupervisorId,
        reason: reason.trim()
      });
      toast.success("Supervisor override applied successfully.");
      onAssignmentSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to assign supervisor"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOverride = async () => {
    const ok = await confirmAction({
      title: "Remove the manual override?",
      message: "The supervisor will be worked out again from the organizational hierarchy.",
      confirmLabel: "Remove override",
      danger: true,
    });
    if (!ok) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/employees/${employeeId}/supervisor-override`);
      toast.success("Supervisor override removed successfully.");
      onAssignmentSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to remove override"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Supervisor Override</DialogTitle>
          <DialogDescription>
            Bypass the automatic organizational hierarchy by manually assigning a supervisor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          
          <div className="bg-status-warning-surface border border-status-warning-border rounded-lg p-3 flex gap-3 text-status-warning-foreground text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Manual overrides should be used sparingly.</p>
              <p>Consider updating the Job Role mappings in Master Data instead if this is a permanent structural change.</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-primary-400"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 no-scrollbar border rounded-xl p-2 bg-muted">
            {searchError ? (
              <p role="alert" className="text-center text-sm text-status-danger-foreground py-4">{searchError}</p>
            ) : employees.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">No employees found.</p>
            ) : (
              employees.map(emp => (
                <div 
                  key={emp.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${selectedSupervisorId === emp.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40' : 'border-border bg-surface hover:bg-muted/50'}`}
                  onClick={() => setSelectedSupervisorId(emp.id)}
                >
                  <div>
                    <p className="text-sm font-semibold">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-muted-foreground">{emp.employeeNumber} · {emp.jobRole?.title}</p>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {currentSupervisorId === emp.id ? "Current" : ""}
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Reason for Override *</label>
            <textarea 
              className="w-full text-sm rounded-lg border border-border bg-surface p-2 focus:outline-none focus:border-primary-400 min-h-[80px]"
              placeholder="Explain why this manual override is necessary..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button 
              type="button"
              variant="delete" 
              
              onClick={handleRemoveOverride}
              disabled={isSubmitting}>
              Remove Override
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button 
                type="button" 
                onClick={handleAssign} 
                disabled={!selectedSupervisorId || !reason.trim() || isSubmitting}
              >
                Apply Override
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
