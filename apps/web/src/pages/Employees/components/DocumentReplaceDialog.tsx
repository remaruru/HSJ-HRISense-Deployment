import { confirmAction } from "@/components/shared/ConfirmProvider";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { toast } from "sonner";
import { UploadCloud, FileText } from "lucide-react";
import { getApiErrorMessage } from "@/utils/error-handler.util";

export function DocumentReplaceDialog({ 
  isOpen, 
  onClose, 
  document,
  onReplaceSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  document: any | null;
  onReplaceSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytes, setBytes] = useState<{ loaded: number; total: number } | null>(null);

  const handleReplace = async () => {
    if (!file || !document) return;

    const ok = await confirmAction({
      title: "Replace this document's file?",
      message: "The current file is replaced by the one you chose. This can't be undone.",
      confirmLabel: "Replace file",
      danger: true,
    });
    if (!ok) return;

    setIsReplacing(true);
    setProgress(0);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.put(`/documents/${document.id}/file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
            setBytes({ loaded: progressEvent.loaded, total: progressEvent.total });
          }
        }
      });
      toast.success("Document replaced successfully");
      onReplaceSuccess();
      onClose();
      setFile(null);
      setProgress(0);
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to replace document"));
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace Document File</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-status-warning-surface text-status-warning-foreground p-3 rounded-lg text-xs">
            <p className="font-semibold">Warning: You are replacing an existing file.</p>
            <p>This will permanently delete the previous file ({document?.originalFilename}) and upload a new one. A timeline event will be created.</p>
          </div>

          <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
            {file ? (
              <div className="flex flex-col items-center w-full">
                <FileText className="h-10 w-10 text-primary-500 mb-2" />
                <p className="text-sm font-semibold truncate max-w-full">{file.name}</p>
                <p className="text-xs text-muted-foreground mb-4">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                {!isReplacing && (
                  <Button variant="delete" size="sm" onClick={() => setFile(null)}>Remove File</Button>
                )}
                {isReplacing && (
                  <div className="w-full mt-4 space-y-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-border-soft">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {progress}%{bytes ? ` · ${formatBytes(bytes.loaded)} of ${formatBytes(bytes.total)} sent` : ''}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">Drag & drop your new file here</p>
                <p className="text-xs text-muted-foreground mb-4">PDF, JPG, PNG up to 5MB</p>
                <input 
                  type="file" 
                  id="replace-upload" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                />
                <label htmlFor="replace-upload">
                  <Button size="sm" variant="outline" type="button" onClick={() => document.getElementById("replace-upload")?.click()}>
                    Browse Files
                  </Button>
                </label>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isReplacing}>Cancel</Button>
          <Button onClick={handleReplace} disabled={!file || isReplacing} variant="destructive">
            {isReplacing ? "Replacing..." : "Replace File"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
