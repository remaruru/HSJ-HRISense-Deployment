import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Filter, RefreshCw, Briefcase, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RecruitmentService, JobOpening, JobOpeningStatus } from "@/services/recruitment.service";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { LoadError } from "@/components/shared/LoadError";

const statusColor: Record<JobOpeningStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft",
  OPEN: "bg-success-50 text-success-700 border-success-200",
  CLOSED: "bg-warning-light text-warning-dark border-warning",
  FILLED: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900",
  ARCHIVED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-surface-2 dark:text-secondary-foreground dark:border-border-soft",
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export default function JobOpeningsPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as any;
  const { user } = useAuth();
  const { hasPermission, tier } = usePermission();
  const isFullHR = tier === "FULL" || hasPermission("recruitment", "manage");

  const [data, setData] = useState<JobOpening[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(searchParams.page ? Number(searchParams.page) : 1);
  const [limit, setLimit] = useState(searchParams.limit ? Number(searchParams.limit) : 25);

  // Filters
  const [statusFilter, setStatusFilter] = useState<JobOpeningStatus | "">(searchParams.status || "");
  const [searchInput, setSearchInput] = useState(searchParams.search || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const fetchOpenings = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await RecruitmentService.getJobOpenings({
        page,
        limit,
        status: statusFilter,
        search: debouncedSearch,
      });
      setData(res.items);
      setTotal(res.total);

      // Update URL silently
      navigate({
        to: "/recruitment/openings",
        search: {
          page: page > 1 ? page : undefined,
          limit: limit !== 25 ? limit : undefined,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        },
        replace: true,
      });
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Job openings could not be loaded."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [page, limit, statusFilter, debouncedSearch]);

  const handleCreate = () => {
    navigate({ to: "/recruitment/openings/new" });
  };

  const handleRowClick = (id: string) => {
    navigate({ to: `/recruitment/openings/${id}` });
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Openings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage recruitment vacancies and track their status.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchOpenings} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          {isFullHR && (
            <Button variant="create" size="sm" onClick={handleCreate} className="gap-2 shadow-pop-color">
              <Plus className="h-4 w-4" />
              New Opening
            </Button>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden hrisense-table-container">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-center bg-surface-2/30">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search title or ref..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-input rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-surface border border-input rounded-lg focus:ring-2 focus:ring-primary-500/20 outline-none w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="FILLED">Filled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto min-h-[400px]">
          {loading && data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <RefreshCw className="h-8 w-8 animate-spin mb-4 text-primary-500" />
              <p>Loading openings...</p>
            </div>
          ) : loadError ? (
            <div className="p-6">
              <LoadError message={loadError} onRetry={fetchOpenings} />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <Briefcase className="h-12 w-12 mb-4 text-slate-300" strokeWidth={1} />
              <p className="text-lg font-medium text-foreground">No openings found</p>
              <p className="text-sm">Try adjusting your filters or search query.</p>
              {isFullHR && (
                <Button variant="create" className="mt-4" onClick={handleCreate}>
                  Create Opening
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50/50 sticky top-0 z-10 border-b border-border dark:bg-surface-2/50">
                <tr>
                  <th className="px-6 py-3 font-semibold">Reference</th>
                  <th className="px-6 py-3 font-semibold">Job Title</th>
                  <th className="px-6 py-3 font-semibold">Unit / Dept</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Vacancies</th>
                  <th className="px-6 py-3 font-semibold text-right">Applicants</th>
                  <th className="px-6 py-3 font-semibold">Closing Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((opening) => (
                  <tr
                    key={opening.id}
                    onClick={() => handleRowClick(opening.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group dark:hover:bg-surface-2"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-primary-700 dark:text-primary-300">
                      {opening.referenceNumber}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {opening.title}
                      <div className="text-xs text-muted-foreground font-normal mt-0.5">
                        {opening.employmentType.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-foreground">{opening.unit?.name}</div>
                      {opening.department && (
                        <div className="text-xs text-muted-foreground mt-0.5">{opening.department.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wide", statusColor[opening.status])}>
                        {opening.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                      {opening.vacancies || "Open"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5 text-foreground font-medium">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {opening._count?.applications || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {formatDate(opening.closingDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {total > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span> results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page * limit >= total || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
