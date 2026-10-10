import React, { useState } from "react";
import { Download, FileText, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecruitmentService } from "@/services/recruitment.service";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/error-handler.util";

interface ApplicantDocumentsTabProps {
  applicationId: string;
  documents: any[];
}

export function ApplicantDocumentsTab({ applicationId, documents }: ApplicantDocumentsTabProps) {
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleDownload = async (documentId: string, filename: string) => {
    try {
      const blob = await RecruitmentService.downloadApplicantDocument(applicationId, documentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to download document."));
    }
  };

  const handlePreview = async (doc: any) => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    
    setSelectedDoc(doc);
    setPreviewError(null);
    setLoadingPreview(true);

    try {
      const res = await RecruitmentService.previewApplicantDocument(applicationId, doc.id);
      
      // If we got a blob, it's successful (PDF). Otherwise an error (DOC/DOCX fallback)
      if (res.type === 'application/pdf') {
        const url = window.URL.createObjectURL(res);
        setPreviewBlobUrl(url);
      } else if (res.type === 'application/json') {
        // Handle error JSON from axios blob response
        const text = await res.text();
        const json = JSON.parse(text);
        setPreviewError(json.message || "Preview unavailable.");
      } else {
        setPreviewError("Preview is unavailable for this document format. Download the file to view it securely.");
      }
    } catch (err: any) {
      // The API client already turned a JSON error body back into an object, so
      // the server's reason (unsupported format, missing file, no access, no
      // connection) is shown as is.
      setPreviewError(getApiErrorMessage(err, "The preview could not be loaded. Download the file to view it."));
    } finally {
      setLoadingPreview(false);
    }
  };

  if (!documents || documents.length === 0) {
    return <p className="text-sm text-muted-foreground pt-8 text-center">No documents uploaded.</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
      {/* Left Column: Document List */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 border-r border-border">
        {documents.map((doc: any) => (
          <div 
            key={doc.id} 
            className={`flex flex-col p-3 border rounded-md transition-colors ${
              selectedDoc?.id === doc.id ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-muted-foreground p-1.5 bg-surface-2 rounded" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate" title={doc.originalFilename}>
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.documentType} &middot; {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="review" 
                size="sm" 
                className="flex-1"
                onClick={() => handlePreview(doc)}>
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDownload(doc.id, doc.originalFilename)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Right Column: Preview Panel */}
      <div className="w-full lg:w-2/3 flex flex-col bg-surface-2 border border-border rounded-lg overflow-hidden">
        {loadingPreview ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p>Loading preview...</p>
          </div>
        ) : previewError ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm max-w-md">{previewError}</p>
            {selectedDoc && (
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => handleDownload(selectedDoc.id, selectedDoc.originalFilename)}
              >
                <Download className="h-4 w-4" /> Download File Securely
              </Button>
            )}
          </div>
        ) : previewBlobUrl ? (
          <iframe 
            src={previewBlobUrl} 
            className="w-full h-full border-0" 
            title="Document Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Eye className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">Select a document to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
