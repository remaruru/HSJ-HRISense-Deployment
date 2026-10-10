import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, FileText } from "lucide-react";
import { api } from "@/services/api";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/error-handler.util";

export function DocumentUploadDialog({ 
  isOpen, 
  onClose, 
  employeeId,
  onUploadSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  employeeId: string;
  onUploadSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("EMPLOYMENT_CONTRACT");
  const [isVisibleToEmployee, setIsVisibleToEmployee] = useState(true);
  const [isVisibleToSupervisor, setIsVisibleToSupervisor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bytes, setBytes] = useState<{ loaded: number; total: number } | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("isVisibleToEmployee", String(isVisibleToEmployee));
    formData.append("isVisibleToSupervisor", String(isVisibleToSupervisor));

    try {
      await api.post(`/employees/${employeeId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
            setBytes({ loaded: progressEvent.loaded, total: progressEvent.total });
          }
        }
      });
      toast.success("Document uploaded successfully");
      onUploadSuccess();
      onClose();
      setFile(null);
      setProgress(0);
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to upload document"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
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

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVisibleToEmployee} onChange={(e) => setIsVisibleToEmployee(e.target.checked)} />
              Visible to Employee
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isVisibleToSupervisor} onChange={(e) => setIsVisibleToSupervisor(e.target.checked)} />
              Visible to Supervisor
            </label>
          </div>

          <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
            {file ? (
              <div className="flex flex-col items-center w-full">
                <FileText className="h-10 w-10 text-primary-500 mb-2" />
                <p className="text-sm font-semibold truncate max-w-full">{file.name}</p>
                <p className="text-xs text-muted-foreground mb-4">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                {!isUploading && (
                  <Button variant="delete" size="sm" onClick={() => setFile(null)}>Remove File</Button>
                )}
                {isUploading && (
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
                <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
                <p className="text-xs text-muted-foreground mb-4">PDF, JPG, PNG up to 5MB</p>
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                />
                <label htmlFor="file-upload">
                  <Button size="sm" variant="outline" type="button" onClick={() => document.getElementById("file-upload")?.click()}>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? "Uploading..." : "Upload Document"}
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
