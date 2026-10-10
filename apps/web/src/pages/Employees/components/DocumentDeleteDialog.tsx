import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/error-handler.util";

export function DocumentDeleteDialog({ 
  isOpen, 
  onClose, 
  document,
  onDeleteSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  document: any | null;
  onDeleteSuccess: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!document) return;
    setIsDeleting(true);
    
    try {
      await api.delete(`/documents/${document.id}`);
      toast.success("Document deleted successfully");
      onDeleteSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to delete document"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm">
            Are you sure you want to delete the document <span className="font-bold">{document?.originalFilename}</span>?
          </p>
          <p className="text-sm text-muted-foreground">
            This will soft-delete the document. It will no longer appear in this list or contribute to profile completion.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
            {isDeleting ? "Deleting..." : "Delete Document"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
