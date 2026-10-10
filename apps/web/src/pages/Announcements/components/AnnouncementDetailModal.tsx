import { BreakdownButton, MetricBreakdownDialog, type MetricBreakdownSpec } from "@/components/shared/MetricBreakdown";
import { formatPct } from "@/lib/percent";
import type { AnnouncementRecipientStats } from "@/services/announcement.service";
import { useState, useEffect, useRef } from 'react';
import {
  Megaphone,
  Pin,
  Calendar,
  Clock,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Trash2,
  Plus,
  Archive,
  Edit,
  X,
  Building2,
  Briefcase,
  User,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Announcement,
  AnnouncementService,
  AnnouncementAttachment,
} from '@/services/announcement.service';
import { RecipientListModal } from './RecipientListModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface AnnouncementDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcementId: string | null;
  onEdit: (announcement: Announcement) => void;
  onRefresh: () => void;
}

export function AnnouncementDetailModal({
  open,
  onOpenChange,
  announcementId,
  onEdit,
  onRefresh,
}: AnnouncementDetailModalProps) {
  const [showReadBreakdown, setShowReadBreakdown] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Attachment upload / delete loading
  const [uploadingAttachment, setUploadingAttachment] = useState<boolean>(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recipient list sub-modal
  const [recipientModalOpen, setRecipientModalOpen] = useState<boolean>(false);

  // Confirmations
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState<boolean>(false);
  const [confirmDeleteDraftOpen, setConfirmDeleteDraftOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDetail = async () => {
    if (!announcementId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await AnnouncementService.getAnnouncement(announcementId);
      setAnnouncement(data);
    } catch (err: any) {
      console.error('Failed to load announcement detail', err);
      setError(getApiErrorMessage(err, 'Unable to load announcement details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && announcementId) {
      fetchDetail();
    } else {
      setAnnouncement(null);
      setError(null);
    }
  }, [open, announcementId]);

  const handleDownloadAttachment = async (attachment: AnnouncementAttachment) => {
    if (!announcement) return;
    try {
      toast.info(`Downloading ${attachment.originalFilename}...`);
      await AnnouncementService.downloadAttachment(
        announcement.id,
        attachment.id,
        attachment.originalFilename
      );
    } catch (err: any) {
      console.error('Download failed', err);
      toast.error(getApiErrorMessage(err, 'This attachment is no longer available.'));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !announcement) return;

    // Reset input value so same file can be selected again if needed
    e.target.value = '';

    // File validation
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('This file is too large. Maximum file size is 10 MB.');
      return;
    }

    setUploadingAttachment(true);
    try {
      await AnnouncementService.uploadAttachment(announcement.id, file);
      toast.success('Attachment uploaded successfully.');
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      console.error('Upload failed', err);
      toast.error(getApiErrorMessage(err, 'Failed to upload attachment.'));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!announcement) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await AnnouncementService.deleteAttachment(announcement.id, attachmentId);
      toast.success('Attachment removed.');
      await fetchDetail();
      onRefresh();
    } catch (err: any) {
      console.error('Delete attachment failed', err);
      toast.error(getApiErrorMessage(err, 'Attachments can only be changed before publication.'));
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleArchive = async () => {
    if (!announcement) return;
    setActionLoading(true);
    try {
      await AnnouncementService.archiveAnnouncement(announcement.id);
      toast.success('Announcement archived.');
      setConfirmArchiveOpen(false);
      onOpenChange(false);
      onRefresh();
    } catch (err: any) {
      console.error('Archive failed', err);
      toast.error(getApiErrorMessage(err, 'Failed to archive announcement.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!announcement) return;
    setActionLoading(true);
    try {
      await AnnouncementService.deleteAnnouncement(announcement.id);
      toast.success('Announcement deleted.');
      setConfirmDeleteDraftOpen(false);
      onOpenChange(false);
      onRefresh();
    } catch (err: any) {
      console.error('Delete draft failed', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete draft.'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!open) return null;

  const derived = announcement?.derivedStatus;
  const isEditable = derived === 'DRAFT' || derived === 'SCHEDULED' || derived === 'PUBLISHED';
  const canModifyAttachments = derived === 'DRAFT' || derived === 'SCHEDULED';
  const canArchive = derived === 'PUBLISHED' || derived === 'EXPIRED';
  const canDelete = derived === 'DRAFT';

  const priorityBadge = {
    URGENT: {
      label: 'Urgent',
      className: 'bg-status-danger-surface text-status-danger-foreground border-status-danger-border',
    },
    IMPORTANT: {
      label: 'Important',
      className: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
    },
    NORMAL: {
      label: 'Normal',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    },
  }[announcement?.priority || 'NORMAL'];

  const statusBadge = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-border-soft',
    },
    SCHEDULED: {
      label: 'Scheduled',
      className: 'bg-status-info-surface text-status-info-foreground border-status-info-border',
    },
    PUBLISHED: {
      label: 'Published',
      className: 'bg-status-success-surface text-status-success-foreground border-status-success-border',
    },
    EXPIRED: {
      label: 'Past',
      className: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border',
    },
    ARCHIVED: {
      label: 'Archived',
      className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
    },
  }[derived || 'DRAFT'];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'w-[min(980px,calc(100vw-32px))] sm:max-w-[min(980px,calc(100vw-32px))]',
            'h-[min(820px,calc(100vh-40px))] max-h-[min(820px,calc(100vh-40px))] min-h-[520px]',
            'flex flex-col p-0 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl'
          )}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 sm:px-8 py-4.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {announcement?.title || 'Announcement Details'}
                  </h2>
                  {announcement?.isPinned && (
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 gap-1 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
                      <Pin className="w-3 h-3 text-teal-600 dark:text-primary-300" />
                      Pinned
                    </Badge>
                  )}
                  <Badge variant="outline" className={priorityBadge.className}>
                    {priorityBadge.label}
                  </Badge>
                  <Badge variant="outline" className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Internal HR Communication
                </p>
              </div>
            </div>

            {/* DialogContent renders the close button; a second one showed as two ✕. */}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 min-h-0">
            {loading ? (
              <div className="space-y-4">
                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse w-3/4" />
                <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-status-danger-foreground mx-auto mb-2" />
                <p className="font-semibold text-status-danger-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchDetail} className="mt-3">
                  Retry
                </Button>
              </div>
            ) : announcement ? (
              <>
                {/* Key Timing and Author Details Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-medium">Publish Schedule</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {announcement.publishAt
                          ? format(new Date(announcement.publishAt), 'MMM d, yyyy · h:mm a')
                          : 'Not published yet (Draft)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-medium">Expiry / End Time</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {announcement.expiresAt
                          ? format(new Date(announcement.expiresAt), 'MMM d, yyyy · h:mm a')
                          : 'No expiration'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-medium">Created By</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {announcement.createdBy?.employee
                          ? `${announcement.createdBy.employee.firstName} ${announcement.createdBy.employee.lastName}`
                          : announcement.createdBy?.email || 'HR Department'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Read Statistics Card */}
                <div className="p-5 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/50 via-white to-slate-50 dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                          Recipient Read Statistics
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {derived === 'DRAFT'
                          ? 'Recipients will be snapshotted at time of publication.'
                          : 'Live read confirmation for active employee recipients.'}
                      </p>
                    </div>

                    {derived !== 'DRAFT' && (
                      <Button
                        variant="review"
                        size="sm"
                        onClick={() => setRecipientModalOpen(true)}
                        className="text-xs font-semibold gap-1.5 shrink-0 cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />
                        View Recipients ({announcement.recipientStats?.totalRecipients ?? announcement._count?.recipients ?? 0})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-4 pt-3 border-t border-teal-100 dark:border-teal-950">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                        Recipients
                      </span>
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">
                        {announcement.recipientStats?.totalRecipients ?? announcement._count?.recipients ?? 0}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-status-success-border/80">
                      <span className="text-xs font-semibold text-status-success-foreground block">
                        Read
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-status-success-foreground">
                          {announcement.recipientStats?.readCount ?? 0}
                        </span>
                        {announcement.recipientStats && announcement.recipientStats.totalRecipients > 0 && (
                          <span className="text-xs font-bold text-status-success-foreground">
                            ({formatPct(announcement.recipientStats.readPercent ?? null)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-status-warning-border/80">
                      <span className="text-xs font-semibold text-status-warning-foreground block">
                        Unread
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-status-warning-foreground">
                          {announcement.recipientStats?.unreadCount ??
                            (announcement.recipientStats?.totalRecipients ?? 0)}
                        </span>
                        {announcement.recipientStats && announcement.recipientStats.totalRecipients > 0 && (
                          <span className="text-xs font-bold text-status-warning-foreground">
                            ({formatPct(announcement.recipientStats.unreadPercent ?? null)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {announcement.recipientStats && (
                    <BreakdownButton className="mt-2" onClick={() => setShowReadBreakdown(true)} />
                  )}
                  <MetricBreakdownDialog
                    open={showReadBreakdown}
                    onOpenChange={setShowReadBreakdown}
                    spec={announcement.recipientStats ? readRateSpec(announcement.recipientStats) : null}
                  />
                </div>

                {/* Message Body Section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Announcement Message
                  </h3>
                  <div className="p-5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {announcement.body || announcement.content || '—'}
                  </div>
                </div>

                {/* Audience Section */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Target Audience
                  </h3>
                  <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                    {announcement.audienceScopes && announcement.audienceScopes.length > 0 ? (
                      announcement.audienceScopes.map((scope, idx) => (
                        <div
                          key={scope.id || idx}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                        >
                          {scope.scopeType === 'ALL' && (
                            <>
                              <Users className="w-3.5 h-3.5 text-teal-600 dark:text-primary-300" />
                              <span className="font-semibold">All Active Employees</span>
                            </>
                          )}
                          {scope.scopeType === 'DEPARTMENT' && (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-status-accent-foreground" />
                              <span>Department:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {scope.targetDepartment?.name || 'Department'}
                              </span>
                            </>
                          )}
                          {scope.scopeType === 'UNIT' && (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-status-info-foreground" />
                              <span>Unit:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {scope.targetUnit?.name || 'Unit'}
                              </span>
                            </>
                          )}
                          {scope.scopeType === 'JOB_ROLE' && (
                            <>
                              <Briefcase className="w-3.5 h-3.5 text-status-accent-foreground" />
                              <span>Job Role:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {scope.targetJobRole?.title || 'Role'}
                              </span>
                            </>
                          )}
                          {scope.scopeType === 'EMPLOYEE' && (
                            <>
                              <User className="w-3.5 h-3.5 text-status-success-foreground" />
                              <span>Individual:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {scope.targetEmployee
                                  ? `${scope.targetEmployee.firstName} ${scope.targetEmployee.lastName}`
                                  : 'Employee'}
                              </span>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-muted-foreground">No audience configured</span>
                    )}
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Attachments ({announcement.attachments?.length || 0})
                    </h3>
                    {canModifyAttachments && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                        />
                        <Button
                          variant="create"
                          size="sm"
                          disabled={uploadingAttachment}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 text-xs gap-1 font-semibold">
                          <Plus className="w-3 h-3" />
                          {uploadingAttachment ? 'Uploading...' : 'Add Attachment'}
                        </Button>
                      </>
                    )}
                  </div>

                  {announcement.attachments && announcement.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {announcement.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-teal-600 shrink-0 dark:text-primary-300" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {att.originalFilename}
                              </p>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : 'Document'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadAttachment(att)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-secondary-foreground dark:hover:text-foreground"
                              title="Download attachment"
                            >
                              <Download className="w-4 h-4" />
                            </Button>

                            {canModifyAttachments && (
                              <Button
                                variant="delete"
                                size="sm"
                                disabled={deletingAttachmentId === att.id}
                                onClick={() => handleDeleteAttachment(att.id)}
                                className="h-8 w-8 p-0"
                                title="Remove attachment">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-muted-foreground">
                      No attachments attached to this announcement.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 sm:px-8 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {canDelete && (
                <Button
                  variant="delete"
                  onClick={() => setConfirmDeleteDraftOpen(true)}
                  className="text-xs font-semibold gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </Button>
              )}

              {canArchive && (
                <Button
                  variant="delete"
                  onClick={() => setConfirmArchiveOpen(true)}
                  className="text-xs font-semibold gap-1.5">
                  <Archive className="w-3.5 h-3.5" />
                  Archive Announcement
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold"
              >
                Close
              </Button>

              {isEditable && announcement && (
                <Button variant="update"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(announcement);
                  }}
                  className="text-xs font-semibold gap-1.5 shadow-xs">
                  <Edit className="w-3.5 h-3.5" />
                  Edit Announcement
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipient List Modal */}
      <RecipientListModal
        open={recipientModalOpen}
        onOpenChange={setRecipientModalOpen}
        announcementId={announcement?.id || null}
        announcementTitle={announcement?.title}
      />

      {/* Confirmation Dialog: Archive */}
      <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-status-warning-surface text-status-warning-foreground flex items-center justify-center shrink-0 border border-status-warning-border">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Archive this announcement?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 dark:text-muted-foreground">
                Employees will no longer see it in their announcement feed. Recipient and read history will be preserved.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={() => setConfirmArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={handleArchive}
              className="bg-warning hover:bg-status-warning-foreground text-white font-semibold"
            >
              {actionLoading ? 'Archiving...' : 'Archive'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Delete Draft */}
      <Dialog open={confirmDeleteDraftOpen} onOpenChange={setConfirmDeleteDraftOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-status-danger-surface text-status-danger-foreground flex items-center justify-center shrink-0 border border-status-danger-border">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Delete this draft?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 dark:text-muted-foreground">
                This draft and its uploaded attachments will be permanently removed.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={actionLoading}
              onClick={() => setConfirmDeleteDraftOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={handleDeleteDraft}
              className="bg-danger hover:bg-status-danger-foreground text-white font-semibold"
            >
              {actionLoading ? 'Deleting...' : 'Delete Draft'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Read and unread are two parts of the same recipient list, so they total 100%. */
function readRateSpec(stats: AnnouncementRecipientStats): MetricBreakdownSpec {
  const total = stats.totalRecipients;
  return {
    title: 'Read rate',
    value: formatPct(stats.readPercent ?? null),
    caption: 'Recipients are fixed when the announcement is published.',
    formula:
      total > 0
        ? [`${stats.readCount} read ÷ ${total} recipients × 100 = ${formatPct(stats.readPercent ?? null)}`]
        : ['This announcement has no recipients, so there is no read rate.'],
    columns: ['Recipients', 'Count', 'Share'],
    sections: [
      {
        rows: [
          { label: 'Read', cells: [String(stats.readCount), formatPct(stats.readPercent ?? null)], status: { text: 'Read', tone: 'success' } },
          { label: 'Unread', cells: [String(stats.unreadCount), formatPct(stats.unreadPercent ?? null)], status: { text: 'Unread', tone: 'warning' } },
        ],
      },
    ],
    total: { label: 'TOTAL', cells: [String(total), total > 0 ? '100%' : '—'] },
    notes: ['Shares are rounded so read and unread add up to exactly 100%.'],
  };
}
