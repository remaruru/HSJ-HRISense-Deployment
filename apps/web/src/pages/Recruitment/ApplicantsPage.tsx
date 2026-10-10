import React, { useState, useEffect, useRef } from "react";
import { Search, Filter, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecruitmentService } from "@/services/recruitment.service";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { LoadError } from "@/components/shared/LoadError";

const statusLabel: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  FOR_INTERVIEW: "For Interview",
  INTERVIEWED: "Interviewed",
  FOR_REQUIREMENTS: "For Requirements",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export default function ApplicantsPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as any;

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(searchParams.page ? Number(searchParams.page) : 1);
  const [limit, setLimit] = useState(searchParams.limit ? Number(searchParams.limit) : 25);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.status || "");
  const [searchInput, setSearchInput] = useState(searchParams.search || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const fetchApplications = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await RecruitmentService.getApplications({
        page,
        limit,
        status: statusFilter,
        search: debouncedSearch,
      });
      setData(res.items);
      setTotal(res.total);

      // Update URL silently
      navigate({
        to: "/recruitment/applicants",
        search: {
          page: page > 1 ? page : undefined,
          limit: limit !== 25 ? limit : undefined,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        },
        replace: true,
      });
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Applicants could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, limit, statusFilter, debouncedSearch]);

  const handleRowClick = (id: string) => {
    navigate({ to: `/recruitment/applicants/${id}` });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 h-full flex flex-col space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Applicants</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage job applications.</p>
        </div>
      </div>

      <div className="hrisense-surface p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search by name, reference, email..."
            className="w-full pl-9 pr-4 py-2 text-sm hrisense-control"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <select
              className="w-full pl-9 pr-8 py-2 text-sm hrisense-control appearance-none"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="FOR_INTERVIEW">For Interview</option>
              <option value="FOR_REQUIREMENTS">For Requirements</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
          <Button variant="outline" size="icon" onClick={() => { fetchApplications(); }} title="Refresh" aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </div>

      <div className="hrisense-table-container flex-1">
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 font-medium">Reference</th>
              <th className="px-6 py-4 font-medium">Applicant</th>
              <th className="px-6 py-4 font-medium">Position</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Applied On</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary-400" />
                  <p>Loading applications...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="px-6 py-8">
                  <LoadError message={loadError} onRetry={fetchApplications} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  <p className="text-base font-medium">No applicants found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                </td>
              </tr>
            ) : (
              data.map((app) => (
                <tr 
                  key={app.id} 
                  className="hover:bg-surface-2/50 transition-colors cursor-pointer group"
                  onClick={() => handleRowClick(app.id)}
                >
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {app.referenceNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">
                      {app.applicant.firstName} {app.applicant.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{app.applicant.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-foreground">{app.jobOpening.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">{app.jobOpening.referenceNumber}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="font-normal text-xs bg-surface text-foreground border-border">
                      {statusLabel[app.status] || app.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {formatDate(app.applicationDate)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="review" size="sm" className="-my-2">
                      <Eye className="h-4 w-4" /> View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm mt-4">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of <span className="font-medium text-foreground">{total}</span> applicants
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <div className="px-4 text-foreground font-medium border border-border rounded-md py-1.5 bg-surface-2">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
