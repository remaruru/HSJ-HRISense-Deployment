import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { MetricCard } from "@/components/shared/MetricCard";
import { api } from "@/services/api";
import { RecruitmentService, RecruitmentOverviewStats } from "@/services/recruitment.service";
import { Briefcase, Users, UserCheck, UserX, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { LoadError } from "@/components/shared/LoadError";

export default function RecruitmentOverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RecruitmentOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await RecruitmentService.getOverviewStats();
      setStats(data);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "The recruitment figures could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 space-y-6 max-w-screen-2xl mx-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recruitment Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage job openings and track applicants.</p>
        </div>
      </div>

      {loadError && <LoadError compact message={loadError} onRetry={fetchStats} />}
      <motion.div variants={staggerContainer} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Active Openings"
          value={isLoading ? "..." : loadError ? "—" : stats?.activeOpenings ?? "0"}
          change={0}
          changeLabel="Currently open positions"
          icon={<Briefcase className="h-5 w-5 text-primary-600 dark:text-primary-300" />}
          iconBg="bg-primary-100 dark:bg-primary-900/60"
        />
        <MetricCard
          title="Total Applications"
          value={isLoading ? "..." : loadError ? "—" : stats?.totalApplications ?? "0"}
          change={0}
          changeLabel="All-time applicants"
          icon={<Users className="h-5 w-5 text-accent" />}
          iconBg="bg-accent-light"
        />
        <MetricCard
          title="Under Review"
          value={isLoading ? "..." : loadError ? "—" : stats?.underReview ?? "0"}
          change={0}
          changeLabel="Needs attention"
          icon={<FileText className="h-5 w-5 text-warning-dark" />}
          iconBg="bg-warning-light"
        />
        <MetricCard
          title="For Interview"
          value={isLoading ? "..." : loadError ? "—" : stats?.forInterview ?? "0"}
          change={0}
          changeLabel="Scheduled interviews"
          icon={<Users className="h-5 w-5 text-success" />}
          iconBg="bg-success-light"
        />
        <MetricCard
          title="Hired"
          value={isLoading ? "..." : loadError ? "—" : stats?.hired ?? "0"}
          change={0}
          changeLabel="Successfully placed"
          icon={<UserCheck className="h-5 w-5 text-success" />}
          iconBg="bg-success-light"
        />
        <MetricCard
          title="Rejected / Withdrawn"
          value={isLoading ? "..." : loadError ? "—" : stats?.rejectedOrWithdrawn ?? "0"}
          change={0}
          changeLabel="Closed applications"
          icon={<UserX className="h-5 w-5 text-muted-foreground" />}
          iconBg="bg-muted"
        />
      </motion.div>
    </motion.div>
  );
}
