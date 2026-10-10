import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/error-handler.util";

export function DocumentEditMetadataDialog({ 
  isOpen, 
  onClose, 
  document,
  onUpdateSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  document: any | null;
  onUpdateSuccess: () => void;
}) {
  const [category, setCategory] = useState("EMPLOYMENT_CONTRACT");
  const [isVisibleToEmployee, setIsVisibleToEmployee] = useState(true);
  const [isVisibleToSupervisor, setIsVisibleToSupervisor] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (document && isOpen) {
      setCategory(document.category);
      setIsVisibleToEmployee(document.isVisibleToEmployee);
      setIsVisibleToSupervisor(document.isVisibleToSupervisor);
      setNotes(document.notes || "");
    }
  }, [document, isOpen]);

  // Enforce privacy for sensitive records
  useEffect(() => {
    if (category === "MEDICAL_CLEARANCE" || category === "OTHER") {
      setIsVisibleToSupervisor(false);
    }
  }, [category]);

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);
    
    try {
      await api.put(`/documents/${document.id}`, {
        category,
        isVisibleToEmployee,
        isVisibleToSupervisor,
        notes,
      });
      toast.success("Document metadata updated successfully");
      onUpdateSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to update document metadata"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Document Metadata</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Document Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="RESUME">Resume / CV</option>
              <option value="EMPLOYMENT_CONTRACT">Employment Contract</option>
              <option value="GOVERNMENT_ID">Government ID</option>
              <option value="MEDICAL_CLEARANCE">Medical/Psychological Clearance</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Notes (Optional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this document..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none h-20"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVisibleToEmployee} onChange={(e) => setIsVisibleToEmployee(e.target.checked)} />
              Visible to Employee
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={isVisibleToSupervisor} 
                onChange={(e) => setIsVisibleToSupervisor(e.target.checked)} 
                disabled={category === "MEDICAL_CLEARANCE" || category === "OTHER"}
              />
              <span className={category === "MEDICAL_CLEARANCE" || category === "OTHER" ? "text-muted-foreground" : ""}>
                Visible to Supervisor
                {(category === "MEDICAL_CLEARANCE" || category === "OTHER") && " (Disabled for sensitive types)"}
              </span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
