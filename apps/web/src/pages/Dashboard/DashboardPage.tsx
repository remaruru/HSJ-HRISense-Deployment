import { usePermission } from "@/hooks/usePermission";
import { HRDashboard } from "./HRDashboard";
import { SupervisorDashboard } from "./SupervisorDashboard";
import { EmployeeDashboard } from "./EmployeeDashboard";

export default function DashboardPage() {
  const { tier } = usePermission();

  switch (tier) {
    case 'FULL':
      return <HRDashboard />;
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
    case 'STANDARD':
    default:
      return <EmployeeDashboard />;
  }
}
