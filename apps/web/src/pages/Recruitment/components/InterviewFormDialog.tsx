import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RecruitmentService } from "@/services/recruitment.service";
import { Mail } from "lucide-react";
import { getApiErrorMessage } from '@/utils/error-handler.util';

interface InterviewFormDialogProps {
  applicationId: string;
  interview?: any; // If provided, we are editing/rescheduling
  onClose: () => void;
  onSuccess: () => void;
}

const INTERVIEW_TYPES = ["INITIAL", "TECHNICAL", "PANEL", "FINAL", "OTHER"];
const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"];

export function InterviewFormDialog({ applicationId, interview, onClose, onSuccess }: InterviewFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    scheduledAtDate: "",
    scheduledAtTime: "",
    interviewType: "INITIAL",
    locationDetails: "",
    interviewer: "",
    status: "SCHEDULED",
    notes: "",
    recommendation: "",
  });

  useEffect(() => {
    if (interview) {
      const dateObj = new Date(interview.scheduledAt);
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dateObj.getTime() - tzOffset).toISOString();
      const [d, t] = localISOTime.split("T");

      setFormData({
        scheduledAtDate: d,
        scheduledAtTime: t.substring(0, 5),
        interviewType: interview.interviewType || "INITIAL",
        locationDetails: interview.locationDetails || "",
        interviewer: interview.interviewer || "",
        status: interview.status || "SCHEDULED",
        notes: interview.notes || "",
        recommendation: interview.recommendation || "",
      });
    }
  }, [interview]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!interview) {
        // Schedule new
        const scheduledAt = new Date(`${formData.scheduledAtDate}T${formData.scheduledAtTime}:00`);
        await RecruitmentService.scheduleInterview(applicationId, {
          scheduledAt: scheduledAt.toISOString(),
          interviewType: formData.interviewType,
          locationDetails: formData.locationDetails,
          interviewer: formData.interviewer,
        });
      } else {
        // Check if we are rescheduling or updating status
        const scheduledAt = new Date(`${formData.scheduledAtDate}T${formData.scheduledAtTime}:00`);
        const originalDateObj = new Date(interview.scheduledAt);
        const dateChanged = scheduledAt.getTime() !== originalDateObj.getTime();
        
        if (dateChanged || interview.interviewType !== formData.interviewType || interview.locationDetails !== formData.locationDetails || interview.interviewer !== formData.interviewer) {
          // If schedule info changed, it's a reschedule
          await RecruitmentService.rescheduleInterview(applicationId, interview.id, {
            scheduledAt: scheduledAt.toISOString(),
            interviewType: formData.interviewType,
            locationDetails: formData.locationDetails,
            interviewer: formData.interviewer,
          });
        }
        
        // Always attempt to update status and notes (since updateInterviewStatus handles this)
        if (interview.status !== formData.status || interview.notes !== formData.notes || interview.recommendation !== formData.recommendation) {
          await RecruitmentService.updateInterviewStatus(applicationId, interview.id, {
            status: formData.status,
            notes: formData.notes,
            recommendation: formData.recommendation,
          });
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to save interview."));
    } finally {
      setLoading(false);
    }
  };

  const isScheduling = !interview;
  let isRescheduling = false;
  let isCancelling = false;
  if (interview) {
    const scheduledAt = new Date(`${formData.scheduledAtDate}T${formData.scheduledAtTime}:00`);
    const originalDateObj = new Date(interview.scheduledAt);
    isRescheduling = scheduledAt.getTime() !== originalDateObj.getTime() || interview.interviewType !== formData.interviewType || interview.locationDetails !== formData.locationDetails || interview.interviewer !== formData.interviewer;
    isCancelling = interview.status !== "CANCELLED" && formData.status === "CANCELLED";
  }

  const showWarning = isScheduling || isRescheduling || isCancelling;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">
            {interview ? "Edit Interview" : "Schedule Interview"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 dark:text-muted-foreground">
            &times;
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-status-danger-surface text-status-danger-foreground rounded-md text-sm">
              {error}
            </div>
          )}
          
          <form id="interview-form" onSubmit={handleSubmit} className="space-y-4">
            {interview && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Interview Type</label>
              <select
                name="interviewType"
                value={formData.interviewType}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  name="scheduledAtDate"
                  value={formData.scheduledAtDate}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Time</label>
                <input
                  type="time"
                  name="scheduledAtTime"
                  value={formData.scheduledAtTime}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Location or Meeting Link</label>
              <input
                type="text"
                name="locationDetails"
                value={formData.locationDetails}
                onChange={handleChange}
                placeholder="Zoom link or Room name"
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Interviewer</label>
              <input
                type="text"
                name="interviewer"
                value={formData.interviewer}
                onChange={handleChange}
                placeholder="Name of the interviewer"
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            {interview && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Recommendation</label>
                  <input
                    type="text"
                    name="recommendation"
                    value={formData.recommendation}
                    onChange={handleChange}
                    placeholder="E.g., Proceed to final interview"
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Internal Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Private notes about the interview"
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </>
            )}
          </form>
        </div>
        
        {showWarning && (
          <div className="px-4 pb-2">
            <div className="bg-status-warning-surface border border-status-warning-border text-status-warning-foreground p-3 rounded-md text-sm">
              <p className="font-semibold flex items-center gap-1"><Mail className="w-4 h-4" /> Automatic System Email</p>
              <p className="mt-1">
                {isScheduling && "Saving this interview will automatically send an interview invitation to the applicant."}
                {isCancelling && "Cancelling this interview will automatically notify the applicant by email."}
                {!isScheduling && !isCancelling && isRescheduling && "Saving the new interview schedule will automatically email the updated schedule to the applicant."}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="interview-form" disabled={loading}>
            {loading ? "Saving..." : "Save Interview"}
          </Button>
        </div>
      </div>
    </div>
  );
}
