import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Building,
  Users,
  ShieldCheck,
  Award,
  AlertCircle,
  CheckCircle2,
  Search,
  Check,
  FileText,
  Link2,
  UserPlus,
  Trash2,
  ExternalLink,
  Edit2,
  Ban,
  Filter,
  CheckSquare,
  Square,
  FileCheck,
  Download,
  Upload,
  FileUp,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  TrainingService,
  TrainingActivity,
  TrainingParticipant,
  TrainingActivityDocument,
  TrainingParticipationStatus,
  TRAINING_TYPE_LABELS,
  TRAINING_STATUS_META,
  PARTICIPATION_STATUS_META,
  UpdateParticipantStatusDto,
  BulkUpdateParticipantStatusDto,
} from '@/services/training.service';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface TrainingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId?: string | null;
  onEditActivity?: (activity: TrainingActivity) => void;
  onActivityChanged: () => void;
  isFullHR: boolean;
}

interface EmployeeItem {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  unitId?: string | null;
  departmentId?: string | null;
  jobRoleId?: string | null;
  unit?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  jobRole?: { id: string; title: string } | null;
  employmentState?: string;
}

export function TrainingDetailModal({
  open,
  onOpenChange,
  activityId,
  onEditActivity,
  onActivityChanged,
  isFullHR,
}: TrainingDetailModalProps) {
  const [activity, setActivity] = useState<TrainingActivity | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search for Roster
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Bulk Selection
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState<boolean>(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<TrainingParticipationStatus>('COMPLETED');
  const [bulkCompletedAt, setBulkCompletedAt] = useState<string>('');
  const [bulkValidUntil, setBulkValidUntil] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [submittingBulk, setSubmittingBulk] = useState<boolean>(false);

  // Single Participant Edit Dialog
  const [singleParticipant, setSingleParticipant] = useState<TrainingParticipant | null>(null);
  const [singleStatus, setSingleStatus] = useState<TrainingParticipationStatus>('COMPLETED');
  const [singleCompletedAt, setSingleCompletedAt] = useState<string>('');
  const [singleValidUntil, setSingleValidUntil] = useState<string>('');
  const [singleNotes, setSingleNotes] = useState<string>('');
  const [submittingSingle, setSubmittingSingle] = useState<boolean>(false);

  // Add Participants Modal
  const [addParticipantsOpen, setAddParticipantsOpen] = useState<boolean>(false);
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [newParticipantSearch, setNewParticipantSearch] = useState<string>('');
  const [selectedNewEmployeeIds, setSelectedNewEmployeeIds] = useState<string[]>([]);
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false);

  // Cancel Activity Confirmation Dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Certificate Upload State
  const [certParticipant, setCertParticipant] = useState<TrainingParticipant | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState<boolean>(false);

  // Activity Document Upload State
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState<boolean>(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docNotes, setDocNotes] = useState<string>('');
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);

  // Fetch Activity Data
  const fetchActivity = async () => {
    if (!activityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await TrainingService.getActivity(activityId);
      setActivity(data);
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to load training activity details.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && activityId) {
      fetchActivity();
      setSelectedEmployeeIds([]);
      setSearch('');
      setStatusFilter('ALL');
    }
  }, [open, activityId]);

  // Load active employees for Add Participants dialog
  const loadEmployeesForAdd = async () => {
    try {
      let allEmps: EmployeeItem[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const empRes = await api.get(`/employees?page=${page}&limit=500&employmentState=ACTIVE&isArchived=false`);
        const pageData = empRes.data?.data || [];
        allEmps = allEmps.concat(pageData);
        totalPages = empRes.data?.totalPages || 1;
        page++;
        if (page > 20) break; // Safeguard
      }
      setAllEmployees(allEmps);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The employee list for adding participants could not be loaded.'), {
        id: 'training-employees',
      });
    }
  };

  const handleOpenAddParticipants = () => {
    setSelectedNewEmployeeIds([]);
    setNewParticipantSearch('');
    loadEmployeesForAdd();
    setAddParticipantsOpen(true);
  };

  // Filtered Participants Roster
  const filteredParticipants = useMemo(() => {
    if (!activity?.participants) return [];
    let list = [...activity.participants];

    if (statusFilter !== 'ALL') {
      list = list.filter((p) => p.participationStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q) ||
          p.employee.employeeNumber?.toLowerCase().includes(q) ||
          p.employee.jobRole?.title?.toLowerCase().includes(q) ||
          p.employee.department?.name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activity?.participants, statusFilter, search]);

  // Bulk Selection Handlers
  const isAllSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => selectedEmployeeIds.includes(p.employeeId));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredParticipants.map((p) => p.employeeId));
    }
  };

  const toggleSelectOne = (empId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const openBulkStatusModal = (status: TrainingParticipationStatus) => {
    setBulkTargetStatus(status);
    const today = new Date().toISOString().split('T')[0];
    setBulkCompletedAt(status === 'COMPLETED' ? today : '');
    setBulkValidUntil('');
    setBulkNotes('');
    setBulkActionOpen(true);
  };

  const handleConfirmBulkUpdate = async () => {
    if (!activityId || selectedEmployeeIds.length === 0) return;
    setSubmittingBulk(true);
    try {
      const payload: BulkUpdateParticipantStatusDto = {
        employeeIds: selectedEmployeeIds,
        status: bulkTargetStatus,
        completedAt: bulkCompletedAt || undefined,
        validUntil: bulkValidUntil || undefined,
        notes: bulkNotes.trim() || undefined,
      };

      await TrainingService.bulkUpdateParticipantStatus(activityId, payload);
      toast.success(
        `Updated ${selectedEmployeeIds.length} participant${
          selectedEmployeeIds.length === 1 ? '' : 's'
        } to ${PARTICIPATION_STATUS_META[bulkTargetStatus].label}.`
      );
      setBulkActionOpen(false);
      setSelectedEmployeeIds([]);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to update participant statuses.');
      toast.error(msg);
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Single Participant Modal Handlers
  const openSingleEditModal = (p: TrainingParticipant) => {
    setSingleParticipant(p);
    setSingleStatus(p.participationStatus);
    setSingleCompletedAt(p.completedAt ? p.completedAt.split('T')[0] : '');
    setSingleValidUntil(p.validUntil ? p.validUntil.split('T')[0] : '');
    setSingleNotes(p.notes || '');
  };

  const handleSaveSingleStatus = async () => {
    if (!activityId || !singleParticipant) return;
    setSubmittingSingle(true);
    try {
      const payload: UpdateParticipantStatusDto = {
        participationStatus: singleStatus,
        completedAt: singleCompletedAt || (singleStatus === 'COMPLETED' ? new Date().toISOString() : null),
        validUntil: singleValidUntil || null,
        notes: singleNotes.trim() || null,
      };

      await TrainingService.updateParticipantStatus(
        activityId,
        singleParticipant.employeeId,
        payload
      );
      toast.success(`Updated status for ${singleParticipant.employee.firstName} ${singleParticipant.employee.lastName}.`);
      setSingleParticipant(null);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to update participant.');
      toast.error(msg);
    } finally {
      setSubmittingSingle(false);
    }
  };

  // Add Participants Action
  const availableEmployeesToAdd = useMemo(() => {
    if (!activity) return [];
    const existingIds = new Set(activity.participants.map((p) => p.employeeId));
    let list = allEmployees.filter((e) => !existingIds.has(e.id));

    if (newParticipantSearch.trim()) {
      const q = newParticipantSearch.toLowerCase();
      list = list.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeNumber?.toLowerCase().includes(q) ||
          e.jobRole?.title?.toLowerCase().includes(q) ||
          e.department?.name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allEmployees, activity, newParticipantSearch]);

  const handleConfirmAddParticipants = async () => {
    if (!activityId || selectedNewEmployeeIds.length === 0) return;
    setSubmittingAdd(true);
    try {
      await TrainingService.addParticipants(activityId, {
        employeeIds: selectedNewEmployeeIds,
      });
      toast.success(
        `Added ${selectedNewEmployeeIds.length} participant${
          selectedNewEmployeeIds.length === 1 ? '' : 's'
        } to the roster.`
      );
      setAddParticipantsOpen(false);
      setSelectedNewEmployeeIds([]);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to add participants.');
      toast.error(msg);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Cancel Activity Action
  const handleConfirmCancelActivity = async () => {
    if (!activityId) return;
    setCancelling(true);
    try {
      await TrainingService.cancelActivity(activityId);
      toast.success('Training activity cancelled.');
      setCancelDialogOpen(false);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to cancel training activity.');
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  // Certificate Download / Upload Actions
  const handleDownloadCertificate = async (p: TrainingParticipant) => {
    if (!activityId) return;
    try {
      await TrainingService.downloadCertificate(
        activityId,
        p.employeeId,
        p.certificateOriginalFilename || `${p.employee.firstName}_${p.employee.lastName}_Certificate.pdf`
      );
      toast.success('Certificate downloaded successfully.');
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to download certificate.');
      toast.error(msg);
    }
  };

  const handleOpenUploadCertificate = (p: TrainingParticipant) => {
    setCertParticipant(p);
    setCertFile(null);
  };

  const handleConfirmUploadCertificate = async () => {
    if (!activityId || !certParticipant || !certFile) return;
    setUploadingCert(true);
    try {
      await TrainingService.uploadCertificate(activityId, certParticipant.employeeId, certFile);
      toast.success(
        `Certificate uploaded for ${certParticipant.employee.firstName} ${certParticipant.employee.lastName}.`
      );
      setCertParticipant(null);
      setCertFile(null);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to upload certificate.');
      toast.error(msg);
    } finally {
      setUploadingCert(false);
    }
  };

  // Activity Document Download / Upload Actions
  const handleDownloadDocument = async (doc: TrainingActivityDocument) => {
    if (!activityId) return;
    try {
      await TrainingService.downloadActivityDocument(activityId, doc.id, doc.originalFilename);
      toast.success('Document downloaded successfully.');
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to download document.');
      toast.error(msg);
    }
  };

  const handleConfirmUploadDocument = async () => {
    if (!activityId || !docFile) return;
    setUploadingDoc(true);
    try {
      await TrainingService.uploadActivityDocument(activityId, docFile, docNotes);
      toast.success('Activity document uploaded successfully.');
      setDocFile(null);
      setDocNotes('');
      setUploadDocModalOpen(false);
      fetchActivity();
      onActivityChanged();
    } catch (err: any) {
      const msg = getApiErrorMessage(err, 'Failed to upload document.');
      toast.error(msg);
    } finally {
      setUploadingDoc(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 border border-border shadow-2xl rounded-2xl">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">Loading activity details...</p>
          </div>
        ) : error || !activity ? (
          <div className="p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-danger mx-auto" />
            <p className="text-sm font-semibold text-danger-dark">{error || 'Activity not found.'}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Close
            </Button>
          </div>
        ) : (
          <>
            {/* ── Modal Header ── */}
            <DialogHeader className="p-6 pb-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-100 dark:border-primary-900 shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DialogTitle className="text-xl font-bold font-heading">
                        {activity.title}
                      </DialogTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-semibold border',
                          TRAINING_STATUS_META[activity.status].badgeClass
                        )}
                      >
                        {TRAINING_STATUS_META[activity.status].label}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {TRAINING_TYPE_LABELS[activity.type]}
                      </Badge>
                      {activity.complianceRequirement && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-status-success-surface text-status-success-foreground border-status-success-border flex items-center gap-1"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Compliance: {activity.complianceRequirement.title}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" /> {activity.provider}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {activity.venue}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(activity.startDate).toLocaleDateString()}
                        {activity.startDate !== activity.endDate && ` – ${new Date(activity.endDate).toLocaleDateString()}`}
                      </span>
                      {activity.hoursCredit && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {activity.hoursCredit} Hours Credit
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isFullHR && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="update"
                      size="sm"
                      onClick={() => onEditActivity?.(activity)}
                      className="text-xs gap-1.5 h-8"
                      disabled={activity.status === 'CANCELLED'}>
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit Activity
                    </Button>
                    {activity.status !== 'CANCELLED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelDialogOpen(true)}
                        className="text-xs gap-1.5 h-8 text-status-danger-foreground hover:bg-status-danger-surface dark:hover:bg-status-danger-foreground/40"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {/* ── Summary Stats Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground block">Total Assigned</span>
                  <span className="text-xl font-bold text-foreground">
                    {activity.participantStats.total}
                    {activity.maxParticipants && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        / {activity.maxParticipants} cap
                      </span>
                    )}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-status-success-surface/50 border border-status-success-border">
                  <span className="text-[11px] font-semibold text-status-success-foreground block">
                    Completed
                  </span>
                  <span className="text-xl font-bold text-status-success-foreground">
                    {activity.participantStats.completed}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-status-danger-surface/50 border border-status-danger-border">
                  <span className="text-[11px] font-semibold text-status-danger-foreground block">
                    Did Not Attend
                  </span>
                  <span className="text-xl font-bold text-status-danger-foreground">
                    {activity.participantStats.didNotAttend}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-status-warning-surface/50 border border-status-warning-border">
                  <span className="text-[11px] font-semibold text-status-warning-foreground block">
                    Excused
                  </span>
                  <span className="text-xl font-bold text-status-warning-foreground">
                    {activity.participantStats.excused}
                  </span>
                </div>
              </div>

              {/* ── Section: Description & External Materials Link ── */}
              {(activity.description || activity.materialsUrl) && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-border space-y-2">
                  {activity.description && (
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {activity.description}
                    </p>
                  )}
                  {activity.materialsUrl && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground">External Materials Link:</span>
                        <a
                          href={activity.materialsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline font-medium truncate max-w-md"
                        >
                          {activity.materialsUrl}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Section: Uploaded Activity Documents (FULL HR Only) ── */}
              {isFullHR && (
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/30 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <h3 className="text-xs font-bold font-heading text-foreground">
                        Activity Documents ({activity.documents?.length || 0})
                      </h3>
                    </div>
                    {activity.status !== 'CANCELLED' && (
                      <Button
                        variant="create"
                        size="sm"
                        onClick={() => {
                          setDocFile(null);
                          setDocNotes('');
                          setUploadDocModalOpen(true);
                        }}
                        className="text-xs h-7 gap-1">
                        <FileUp className="h-3 w-3" />
                        Upload Document
                      </Button>
                    )}
                  </div>

                  {!activity.documents || activity.documents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1">
                      No protected activity documents uploaded yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60 border border-border/80 rounded-lg overflow-hidden bg-background">
                      {activity.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-foreground block truncate">
                                {doc.originalFilename}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(1)} KB` : '—'} · Uploaded{' '}
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                                {doc.notes && ` · ${doc.notes}`}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                            className="text-xs h-7 gap-1 shrink-0 text-primary hover:text-primary"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Section: Participant Roster & Management ── */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold font-heading text-foreground">
                      Participant Roster ({filteredParticipants.length})
                    </h3>
                  </div>

                  {isFullHR && activity.status !== 'CANCELLED' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="create"
                        size="sm"
                        onClick={handleOpenAddParticipants}
                        className="text-xs gap-1.5 h-8">
                        <UserPlus className="h-3.5 w-3.5" />
                        Add Participants
                      </Button>
                    </div>
                  )}
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-border">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search participant by name, employee #, role..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 text-xs h-8 bg-background"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm focus:outline-none"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="DID_NOT_ATTEND">Did Not Attend</option>
                      <option value="EXCUSED">Excused</option>
                    </select>
                  </div>
                </div>

                {/* ── Bulk Actions Floating Toolbar (When checked) ── */}
                {isFullHR && selectedEmployeeIds.length > 0 && activity.status !== 'CANCELLED' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-primary-50/90 dark:bg-primary-950/80 border border-primary-200 dark:border-primary-800 flex flex-wrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-xs">
                        {selectedEmployeeIds.length} Selected
                      </Badge>
                      <span className="text-xs font-semibold text-primary-950 dark:text-primary-100">
                        Bulk Update Actions:
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openBulkStatusModal('COMPLETED')}
                        className="text-xs h-7 bg-success hover:bg-status-success-foreground"
                      >
                        Mark Completed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBulkStatusModal('DID_NOT_ATTEND')}
                        className="text-xs h-7 border-status-danger-border text-status-danger-foreground hover:bg-status-danger-surface"
                      >
                        Mark Did Not Attend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBulkStatusModal('EXCUSED')}
                        className="text-xs h-7 border-status-warning-border text-status-warning-foreground hover:bg-status-warning-surface"
                      >
                        Mark Excused
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBulkStatusModal('ASSIGNED')}
                        className="text-xs h-7"
                      >
                        Reset Assigned
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Participants Roster Table */}
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-muted-foreground font-semibold border-b border-border">
                        <tr>
                          {isFullHR && activity.status !== 'CANCELLED' && (
                            <th className="px-3 py-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={toggleSelectAll}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 dark:border-border-soft"
                              />
                            </th>
                          )}
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Department / Role</th>
                          <th className="px-4 py-3">Participation Status</th>
                          <th className="px-4 py-3">Completed Date</th>
                          <th className="px-4 py-3">Compliance</th>
                          <th className="px-4 py-3">Certificate</th>
                          {isFullHR && activity.status !== 'CANCELLED' && (
                            <th className="px-4 py-3 text-right">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredParticipants.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-8 text-center text-xs text-muted-foreground"
                            >
                              No participants match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          filteredParticipants.map((p) => {
                            const isSelected = selectedEmployeeIds.includes(p.employeeId);
                            const meta = PARTICIPATION_STATUS_META[p.participationStatus];
                            return (
                              <tr
                                key={p.id}
                                className={cn(
                                  'hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors',
                                  isSelected && 'bg-primary-50/30 dark:bg-primary-950/20'
                                )}
                              >
                                {isFullHR && activity.status !== 'CANCELLED' && (
                                  <td className="px-3 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectOne(p.employeeId)}
                                      className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 dark:border-border-soft"
                                    />
                                  </td>
                                )}
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-foreground">
                                    {p.employee.firstName} {p.employee.lastName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    #{p.employee.employeeNumber || '—'}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  <div>{p.employee.jobRole?.title || 'No Role'}</div>
                                  <div className="text-[11px] text-muted-foreground/70">
                                    {p.employee.department?.name || p.employee.unit?.name || '—'}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[11px] font-semibold border', meta.badgeClass)}
                                  >
                                    {meta.label}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {p.completedAt ? (
                                    <span>{new Date(p.completedAt).toLocaleDateString()}</span>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {p.complianceRecord ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-status-success-surface text-status-success-foreground border-status-success-border"
                                    >
                                      ✓ Fulfilled
                                    </Badge>
                                  ) : activity.complianceRequirement ? (
                                    <span className="text-[11px] text-status-warning-foreground">
                                      Pending Completion
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {p.certificateOriginalFilename ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-1 max-w-[130px] truncate"
                                        title={p.certificateOriginalFilename}
                                      >
                                        <Award className="h-3 w-3 text-primary shrink-0" />
                                        <span className="truncate">{p.certificateOriginalFilename}</span>
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleDownloadCertificate(p)}
                                        className="text-primary hover:text-primary"
                                        title="Download Certificate"
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                      {isFullHR && activity.status !== 'CANCELLED' && (
                                        <Button
                                          variant="update"
                                          size="sm"
                                          onClick={() => handleOpenUploadCertificate(p)}
                                          >
                                          Replace
                                        </Button>
                                      )}
                                    </div>
                                  ) : isFullHR && activity.status !== 'CANCELLED' && p.participationStatus === 'COMPLETED' ? (
                                    <Button
                                      variant="create"
                                      size="sm"
                                      onClick={() => handleOpenUploadCertificate(p)}
                                      className="gap-1 border-dashed">
                                      <Upload className="h-2.5 w-2.5" />
                                      Upload Cert
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                {isFullHR && activity.status !== 'CANCELLED' && (
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="update"
                                      size="sm"
                                      onClick={() => openSingleEditModal(p)}
                                      className="text-xs h-7">
                                      Update
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Dialog: Bulk Update Outcomes ── */}
        <Dialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading">
                Update {selectedEmployeeIds.length} Selected Participant{selectedEmployeeIds.length === 1 ? '' : 's'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border">
                <span className="font-semibold text-foreground block">
                  Target Outcome: <span className="text-primary">{PARTICIPATION_STATUS_META[bulkTargetStatus].label}</span>
                </span>
                {bulkTargetStatus === 'COMPLETED' && activity?.complianceRequirement && (
                  <p className="text-[11px] text-status-success-foreground mt-1">
                    ✓ This will automatically satisfy compliance requirement: <strong>{activity.complianceRequirement.title}</strong> for all selected participants.
                  </p>
                )}
              </div>

              {bulkTargetStatus === 'COMPLETED' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Completion Date</label>
                    <Input
                      type="date"
                      value={bulkCompletedAt}
                      onChange={(e) => setBulkCompletedAt(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Valid Until Date <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      type="date"
                      value={bulkValidUntil}
                      onChange={(e) => setBulkValidUntil(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Notes / Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="e.g. Completed with honors / Excused due to official travel"
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkActionOpen(false)}
                disabled={submittingBulk}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmBulkUpdate}
                disabled={submittingBulk}
                className="text-xs min-w-[100px]"
              >
                {submittingBulk ? 'Updating...' : 'Confirm Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Single Participant Outcome ── */}
        <Dialog open={Boolean(singleParticipant)} onOpenChange={(o) => !o && setSingleParticipant(null)}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading">
                Update Participant Outcome
              </DialogTitle>
              {singleParticipant && (
                <p className="text-xs text-muted-foreground">
                  {singleParticipant.employee.firstName} {singleParticipant.employee.lastName} (#{singleParticipant.employee.employeeNumber})
                </p>
              )}
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Participation Status</label>
                <select
                  value={singleStatus}
                  onChange={(e) => setSingleStatus(e.target.value as TrainingParticipationStatus)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                >
                  <option value="ASSIGNED">Assigned</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DID_NOT_ATTEND">Did Not Attend</option>
                  <option value="EXCUSED">Excused</option>
                </select>
              </div>

              {singleStatus === 'COMPLETED' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Completion Date</label>
                    <Input
                      type="date"
                      value={singleCompletedAt}
                      onChange={(e) => setSingleCompletedAt(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Valid Until Date <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      type="date"
                      value={singleValidUntil}
                      onChange={(e) => setSingleValidUntil(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Notes / Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
                  placeholder="Remarks..."
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSingleParticipant(null)}
                disabled={submittingSingle}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSingleStatus}
                disabled={submittingSingle}
                className="text-xs"
              >
                {submittingSingle ? 'Saving...' : 'Save Outcome'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Add More Participants ── */}
        <Dialog open={addParticipantsOpen} onOpenChange={setAddParticipantsOpen}>
          <DialogContent className="max-w-lg p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading">
                Add Participants to Activity
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Search and select active employees to add to this training roster.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, number, department..."
                  value={newParticipantSearch}
                  onChange={(e) => setNewParticipantSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border border-border rounded-xl p-2">
                {availableEmployeesToAdd.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No eligible active employees found.
                  </p>
                ) : (
                  availableEmployeesToAdd.map((emp) => {
                    const isSelected = selectedNewEmployeeIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() =>
                          setSelectedNewEmployeeIds((prev) =>
                            prev.includes(emp.id)
                              ? prev.filter((id) => id !== emp.id)
                              : [...prev, emp.id]
                          )
                        }
                        className={cn(
                          'p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary-50/80 border-primary-300 dark:bg-primary-950/60 dark:border-primary-800'
                            : 'bg-card border-border hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        )}
                      >
                        <div>
                          <span className="font-semibold text-foreground">
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-2">
                            #{emp.employeeNumber || '—'} · {emp.jobRole?.title || 'No Role'}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center',
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddParticipantsOpen(false)}
                disabled={submittingAdd}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmAddParticipants}
                disabled={submittingAdd || selectedNewEmployeeIds.length === 0}
                className="text-xs min-w-[120px]"
              >
                {submittingAdd ? 'Adding...' : `Add ${selectedNewEmployeeIds.length} Selected`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Cancel Activity Confirmation ── */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading text-danger">
                Cancel Training Activity?
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                This will mark "{activity?.title || 'this activity'}" as cancelled. Historical participant attendance records already completed will remain intact for audit integrity.
              </p>
            </DialogHeader>

            <DialogFooter className="gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelling}
                className="text-xs"
              >
                Keep Activity
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancelActivity}
                disabled={cancelling}
                className="text-xs"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Upload Certificate ── */}
        <Dialog open={Boolean(certParticipant)} onOpenChange={(o) => !o && setCertParticipant(null)}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading">
                {certParticipant?.certificateOriginalFilename ? 'Replace Participant Certificate' : 'Upload Participant Certificate'}
              </DialogTitle>
              {certParticipant && (
                <p className="text-xs text-muted-foreground">
                  Attach official certificate for {certParticipant.employee.firstName} {certParticipant.employee.lastName} (#{certParticipant.employee.employeeNumber}).
                </p>
              )}
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select Certificate File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer border border-input rounded-md p-1 dark:file:bg-primary-900/40 dark:file:text-primary-300 dark:hover:file:bg-primary-900/60"
                />
                <p className="text-[11px] text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG, WEBP, DOCX (Max 10 MB).
                </p>
              </div>

              {certFile && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Award className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{certFile.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {(certFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCertParticipant(null)}
                disabled={uploadingCert}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmUploadCertificate}
                disabled={uploadingCert || !certFile}
                className="text-xs min-w-[110px]"
              >
                {uploadingCert ? 'Uploading...' : 'Upload Certificate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Upload Activity Document ── */}
        <Dialog open={uploadDocModalOpen} onOpenChange={setUploadDocModalOpen}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-heading">
                Upload Activity Document
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Upload handouts, syllabus, or reference materials for "{activity?.title}".
              </p>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer border border-input rounded-md p-1 dark:file:bg-primary-900/40 dark:file:text-primary-300 dark:hover:file:bg-primary-900/60"
                />
                <p className="text-[11px] text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG, WEBP, DOCX (Max 10 MB).
                </p>
              </div>

              {docFile && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{docFile.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {(docFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Notes / Description <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="e.g. Session 1 Presentation Slides / Training Handout"
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadDocModalOpen(false)}
                disabled={uploadingDoc}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmUploadDocument}
                disabled={uploadingDoc || !docFile}
                className="text-xs min-w-[110px]"
              >
                {uploadingDoc ? 'Uploading...' : 'Upload Document'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
