import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User as UserIcon, Edit2, AlertCircle } from "lucide-react";
import { InterviewFormDialog } from "./InterviewFormDialog";

interface ApplicantInterviewsSectionProps {
  applicationId: string;
  interviews: any[];
  onRefresh: () => void;
  canScheduleInterview: boolean;
  canManageInterview: boolean;
}

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-status-info-surface text-status-info-foreground",
  COMPLETED: "bg-status-success-surface text-status-success-foreground",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-surface-2 dark:text-foreground",
  RESCHEDULED: "bg-status-accent-surface text-status-accent-foreground",
  NO_SHOW: "bg-status-danger-surface text-status-danger-foreground",
};

export function ApplicantInterviewsSection({
  applicationId,
  interviews,
  onRefresh,
  canScheduleInterview,
  canManageInterview,
}: ApplicantInterviewsSectionProps) {
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleEdit = (interview: any) => {
    setSelectedInterview(interview);
    setIsFormOpen(true);
  };

  const handleScheduleNew = () => {
    setSelectedInterview(null);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    onRefresh();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Interviews</h3>
        {canScheduleInterview && (
          <Button size="sm" onClick={handleScheduleNew}>
            Schedule Interview
          </Button>
        )}
      </div>
      <div className="p-4">
        {(!interviews || interviews.length === 0) ? (
          <div className="text-center py-8 text-gray-500 flex flex-col items-center dark:text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 opacity-20" />
            <p>No interviews scheduled</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map((iv) => (
              <div key={iv.id} className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-lg flex items-center gap-2">
                      {iv.interviewType} Interview
                      <Badge className={statusColor[iv.status] || "bg-gray-100 dark:bg-surface-2"}>
                        {iv.status}
                      </Badge>
                    </h4>
                  </div>
                  {canManageInterview && (
                    <Button variant="update" size="sm" onClick={() => handleEdit(iv)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mt-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(iv.scheduledAt).toLocaleDateString("en-PH", { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {new Date(iv.scheduledAt).toLocaleTimeString("en-PH", { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {iv.locationDetails && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {iv.locationDetails}
                    </div>
                  )}
                  {iv.interviewer && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      {iv.interviewer}
                    </div>
                  )}
                </div>

                {(iv.notes || iv.recommendation) && (
                  <div className="mt-4 pt-3 border-t dark:border-gray-700">
                    {iv.recommendation && (
                      <p className="text-sm">
                        <span className="font-medium">Recommendation:</span> {iv.recommendation}
                      </p>
                    )}
                    {iv.notes && (
                      <p className="text-sm mt-1">
                        <span className="font-medium">Notes:</span> {iv.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <InterviewFormDialog
          applicationId={applicationId}
          interview={selectedInterview}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
