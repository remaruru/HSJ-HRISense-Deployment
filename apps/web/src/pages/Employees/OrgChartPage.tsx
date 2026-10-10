import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Users, Search, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, ShieldAlert, Maximize2, Minimize2,
  UserX, UserCog, Heart, Building2, ChevronUp,
  ZoomIn, ZoomOut, RotateCcw, X, Layers, CheckCircle2,
  Move, Target, Terminal, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProtectedImage } from "@/components/ui/ProtectedImage";
import { api } from "@/services/api";
import { useAuth } from "@/providers/AuthProvider";
import { SupervisorAssignmentDialog } from "./components/SupervisorAssignmentDialog";
import { AdditionalOversightDialog } from "./components/AdditionalOversightDialog";
import {
  OversightCardBadge, OversightLegend, OversightLines, OversightProvider, OversightSummary, useOversight,
  type OversightData, type OversightPerson,
} from "./components/OrgChartOversight";
import { cn } from "@/lib/utils";
import { isProfessional } from "@/lib/employment";
import { getApiErrorMessage } from "@/utils/error-handler.util";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgNodeData {
  id: string;
  employeeNumber: string;
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  unitId: string;
  unitName: string;
  unitCode: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  jobRoleId: string;
  jobRoleTitle: string;
  jobRoleCode?: string | null;
  /** Top-level role (HR Officer, Sister) — no supervisor required. */
  noSupervisorRequired?: boolean;
  permissionTier: "FULL" | "SUPERVISOR" | "STANDARD";
  parentJobRoleId?: string | null;
  immediateSupervisorId?: string | null;
  supervisorAssignmentStatus: "ASSIGNED" | "PENDING" | "UNASSIGNED" | "OVERRIDDEN";
  supervisorAssignmentSource?: "AUTO_JOB_ROLE" | "AUTO_DEPARTMENT_HEAD" | "AUTO_UNIT_HEAD" | "MANUAL_OVERRIDE" | null;
  supervisorPendingReason?: string | null;
  employmentStatus?: string;
  employmentState?: string;
  prcLicenseNumber?: string | null;
  professionalRole?: string | null;
  accountStatus: "ACTIVE" | "INACTIVE" | "NO_ACCOUNT";
  isArchived: boolean;
  directReportCount: number;
}

// ─── Unit Metadata ────────────────────────────────────────────────────────────

/*
 * Units are identities, not states.
 *
 * Each unit used to carry its own colour, which meant Social Services wore the
 * URGENT red and Finance wore the POSITIVE green — colour asserting a meaning
 * that was never there. The approved palette reserves those four for meaning, so
 * unit identity is carried by the unit's name and icon on one neutral surface.
 */
const UNIT_SURFACE = "bg-status-neutral-surface";
const UNIT_BORDER = "border-status-neutral-border";
const UNIT_TEXT = "text-status-neutral-foreground";

const UNIT_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  HRD: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Human Resource Department" },
  ADM: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Administrative Services" },
  FIN: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Finance" },
  GSS: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "General Support Services" },
  AUX: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Auxiliary Services" },
  SOC: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Social Services" },
  PCH: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Pastoral Care / Homelife Services" },
  HLT: { color: UNIT_TEXT, bg: UNIT_SURFACE, border: UNIT_BORDER, label: "Health Services" },
};

const UNIT_ORDER = ["HRD", "ADM", "FIN", "GSS", "AUX", "SOC", "PCH", "HLT"];

/**
 * Computes exact unscaled CSS layout offset of an element relative to an ancestor container element.
 * Completely invariant to CSS scale transforms, CSS translate transforms, or zoom animations.
 */
function getUnscaledRelativeOffset(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let curr: HTMLElement | null = el;
  while (curr && curr !== ancestor) {
    x += curr.offsetLeft;
    y += curr.offsetTop;
    curr = curr.offsetParent as HTMLElement | null;
  }
  return {
    x,
    y,
    width: el.offsetWidth,
    height: el.offsetHeight,
  };
}

// ─── SVG Tree Connector for Employee Sub-branches ────────────────────────────

interface SVGTreeConnectorProps {
  parentRef: React.RefObject<HTMLDivElement | null>;
  childrenRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  childrenNodes: OrgNodeData[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  strokeColor?: string;
  onPathsCalculated?: (pathCount: number) => void;
}

function SVGTreeConnector({ parentRef, childrenRefs, childrenNodes, containerRef, strokeColor = "#94a3b8", onPathsCalculated }: SVGTreeConnectorProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const calculatePaths = useCallback(() => {
    if (!containerRef.current || !parentRef.current || childrenNodes.length === 0) {
      setPaths([]);
      if (onPathsCalculated) onPathsCalculated(0);
      return;
    }

    const containerEl = containerRef.current;
    const parentEl = parentRef.current;

    const parentOffset = getUnscaledRelativeOffset(parentEl, containerEl);
    if (parentOffset.width === 0) return;

    const parentX = parentOffset.x + parentOffset.width / 2;
    const parentY = parentOffset.y + parentOffset.height;

    const childCoords: { x: number; y: number }[] = [];

    childrenNodes.forEach((child) => {
      const el = childrenRefs.current.get(child.id);
      if (el && containerEl.contains(el)) {
        const childOffset = getUnscaledRelativeOffset(el, containerEl);
        const childX = childOffset.x + childOffset.width / 2;
        const childY = childOffset.y;
        childCoords.push({ x: childX, y: childY });
      }
    });

    if (childCoords.length === 0) {
      setPaths([]);
      if (onPathsCalculated) onPathsCalculated(0);
      return;
    }

    const minY = Math.min(...childCoords.map((c) => c.y));
    const midY = parentY + Math.max(12, (minY - parentY) / 2);

    const newPaths: string[] = [];
    childCoords.forEach((c) => {
      const pathData = `M ${parentX} ${parentY} V ${midY} H ${c.x} V ${c.y}`;
      newPaths.push(pathData);
    });

    setPaths(newPaths);
    setSvgSize({ w: containerEl.offsetWidth, h: containerEl.offsetHeight });
    if (onPathsCalculated) onPathsCalculated(newPaths.length);
  }, [childrenNodes, parentRef, childrenRefs, containerRef, onPathsCalculated]);

  useLayoutEffect(() => {
    let animFrame: number;
    const update = () => { calculatePaths(); };
    animFrame = requestAnimationFrame(update);
    const timer = setTimeout(calculatePaths, 50);
    return () => {
      cancelAnimationFrame(animFrame);
      clearTimeout(timer);
    };
  }, [calculatePaths]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      calculatePaths();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [calculatePaths, containerRef]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0 overflow-visible"
      style={{ width: "100%", height: "100%" }}
      viewBox={`0 0 ${svgSize.w || 100} ${svgSize.h || 100}`}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={strokeColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── SVG Master Root to Unit Branches Connector Component ─────────────────────

interface SVGMasterUnitConnectorProps {
  rootRef: React.RefObject<HTMLDivElement | null>;
  unitRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  visibleUnitCodes: string[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPathsCalculated?: (count: number) => void;
}

function SVGMasterUnitConnector({ rootRef, unitRefs, visibleUnitCodes, containerRef, onPathsCalculated }: SVGMasterUnitConnectorProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const calculateMasterPaths = useCallback(() => {
    if (!containerRef.current || !rootRef.current || visibleUnitCodes.length === 0) {
      setPaths([]);
      if (onPathsCalculated) onPathsCalculated(0);
      return;
    }

    const containerEl = containerRef.current;
    const rootEl = rootRef.current;

    const rootOffset = getUnscaledRelativeOffset(rootEl, containerEl);
    if (rootOffset.width === 0) return;

    const rootX = rootOffset.x + rootOffset.width / 2;
    const rootY = rootOffset.y + rootOffset.height;

    const unitCoords: { x: number; y: number }[] = [];

    visibleUnitCodes.forEach((code) => {
      const el = unitRefs.current.get(code);
      if (el && containerEl.contains(el)) {
        const uOffset = getUnscaledRelativeOffset(el, containerEl);
        const uX = uOffset.x + uOffset.width / 2;
        const uY = uOffset.y;
        unitCoords.push({ x: uX, y: uY });
      }
    });

    if (unitCoords.length === 0) {
      setPaths([]);
      if (onPathsCalculated) onPathsCalculated(0);
      return;
    }

    unitCoords.sort((a, b) => a.x - b.x);

    const firstUnitX = unitCoords[0].x;
    const lastUnitX = unitCoords[unitCoords.length - 1].x;

    const minY = Math.min(...unitCoords.map((c) => c.y));
    const midY = rootY + Math.max(16, (minY - rootY) / 2);

    const newPaths: string[] = [];

    // 1. Vertical trunk from Hospicio root down to midY
    newPaths.push(`M ${rootX} ${rootY} V ${midY}`);

    // 2. Horizontal distribution line from firstUnitX to lastUnitX at midY
    if (unitCoords.length > 1) {
      newPaths.push(`M ${firstUnitX} ${midY} H ${lastUnitX}`);
    }

    // 3. Drop vertical lines to top center of each visible Unit container
    unitCoords.forEach((u) => {
      newPaths.push(`M ${u.x} ${midY} V ${u.y}`);
    });

    setPaths(newPaths);
    setSvgSize({ w: containerEl.offsetWidth, h: containerEl.offsetHeight });
    if (onPathsCalculated) onPathsCalculated(visibleUnitCodes.length);
  }, [visibleUnitCodes, rootRef, unitRefs, containerRef, onPathsCalculated]);

  useLayoutEffect(() => {
    let animFrame: number;
    const update = () => { calculateMasterPaths(); };
    animFrame = requestAnimationFrame(update);
    const timer = setTimeout(calculateMasterPaths, 50);
    return () => {
      cancelAnimationFrame(animFrame);
      clearTimeout(timer);
    };
  }, [calculateMasterPaths]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      calculateMasterPaths();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [calculateMasterPaths, containerRef]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0 overflow-visible"
      style={{ width: "100%", height: "100%" }}
      viewBox={`0 0 ${svgSize.w || 100} ${svgSize.h || 100}`}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="#6366f1"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── Show Additional Oversight switch ────────────────────────────────────────

function OversightToggle({ checked, onChange, dark = false }: { checked: boolean; onChange: (v: boolean) => void; dark?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "no-pan inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
        dark ? "border-slate-800 bg-slate-950 text-slate-200 hover:text-white" : "border-border bg-surface text-foreground hover:bg-muted/60"
      )}
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      Show Additional Oversight
      <span className={cn("relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors", checked ? "bg-primary-600" : dark ? "bg-slate-700" : "bg-slate-300 dark:bg-slate-700")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", checked ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
      <span className="sr-only">{checked ? "On" : "Off"}</span>
      <span aria-hidden="true" className={cn("text-[10px] font-bold", checked ? "text-primary-600 dark:text-primary-300" : "text-muted-foreground")}>{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function OrgChartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFullHR = user?.permissionTier === "FULL";

  const [nodes, setNodes] = useState<OrgNodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isArchivedFilter, setIsArchivedFilter] = useState<string>("false");

  // Master Data
  const [units, setUnits] = useState<{ id: string; name: string; code: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; unitId?: string }[]>([]);

  // Accordion Expand State
  const [expandedUnitCodes, setExpandedUnitCodes] = useState<Set<string>>(new Set(UNIT_ORDER));
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Fullscreen Workspace State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<"FULL_ORG" | "UNIT">("FULL_ORG");

  // Supervisor Dialog
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [activeTargetEmployee, setActiveTargetEmployee] = useState<OrgNodeData | null>(null);

  // Additional (secondary) oversight — off by default so the normal chart stays clean.
  const [showOversight, setShowOversight] = useState(false);
  const [oversight, setOversight] = useState<OversightData>({ links: [], people: {} });
  const [isOversightDialogOpen, setIsOversightDialogOpen] = useState(false);
  const pageTreeRef = useRef<HTMLDivElement>(null);

  // ── Fetch Master Data & Org Chart ──────────────────────────────────────────
  const fetchMasterData = async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        api.get("/employees/units"),
        api.get("/departments").catch(() => ({ data: { data: [] } })),
      ]);
      setUnits(uRes.data?.data || []);
      setDepartments(dRes.data?.data || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The unit filter options could not be loaded."), { id: "org-chart-units" });
    }
  };

  const chartParams = useCallback(() => {
    const params: any = {};
    if (selectedUnit !== "ALL") params.unitId = selectedUnit;
    if (selectedDept !== "ALL") params.departmentId = selectedDept;
    if (statusFilter !== "ALL") params.supervisorAssignmentStatus = statusFilter;
    if (isArchivedFilter !== "false") params.isArchived = isArchivedFilter;
    return params;
  }, [selectedUnit, selectedDept, statusFilter, isArchivedFilter]);

  const fetchOrgChart = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await api.get("/employees/org-chart", { params: chartParams() });
      const payload = res.data?.data || {};
      const fetchedNodes: OrgNodeData[] = payload.nodes || [];

      setNodes(fetchedNodes);
      setOversight(payload.oversight ?? { links: [], people: {} });

      // Auto-expand nodes with direct reports
      const defaultExpanded = new Set<string>();
      fetchedNodes.forEach((n) => {
        if (n.directReportCount > 0) defaultExpanded.add(n.id);
      });
      setExpandedNodeIds(defaultExpanded);
      setExpandedUnitCodes(new Set(UNIT_ORDER));
    } catch (err) {
      console.error("Failed to load Org Chart data", err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [chartParams]);

  // After HR changes additional oversight: redraw the lines without resetting
  // what the user has expanded or where they are on the chart.
  const refreshOversight = useCallback(async () => {
    try {
      const res = await api.get("/employees/org-chart", { params: chartParams() });
      setOversight(res.data?.data?.oversight ?? { links: [], people: {} });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "The Org Chart could not be refreshed."));
    }
  }, [chartParams]);

  useEffect(() => { fetchMasterData(); }, []);
  useEffect(() => { fetchOrgChart(); }, [fetchOrgChart]);

  // Available Departments
  const availableDepartments = useMemo(() => {
    if (selectedUnit === "ALL") return departments;
    return departments.filter((d) => d.unitId === selectedUnit);
  }, [departments, selectedUnit]);

  useEffect(() => {
    if (selectedUnit !== "ALL" && selectedDept !== "ALL") {
      const isValid = availableDepartments.some((d) => d.id === selectedDept);
      if (!isValid) setSelectedDept("ALL");
    }
  }, [selectedUnit, availableDepartments, selectedDept]);

  // Node Map
  const nodeMap = useMemo(() => {
    const map = new Map<string, OrgNodeData>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // The chart's people, for naming the ends of an oversight line.
  const oversightPeople = useMemo(() => {
    const map = new Map<string, OversightPerson>();
    nodes.forEach((n) => map.set(n.id, { id: n.id, fullName: n.fullName, jobRoleTitle: n.jobRoleTitle, unitName: n.unitName }));
    return map;
  }, [nodes]);

  // Search Matching
  const matchingNodeIds = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.trim().toLowerCase();
    const matched = nodes.filter(
      (n) =>
        n.fullName.toLowerCase().includes(q) ||
        n.employeeNumber.toLowerCase().includes(q) ||
        n.jobRoleTitle.toLowerCase().includes(q) ||
        n.unitName.toLowerCase().includes(q) ||
        (n.departmentName && n.departmentName.toLowerCase().includes(q))
    );
    return new Set(matched.map((n) => n.id));
  }, [nodes, search]);

  // Expand Ancestors on Search
  useEffect(() => {
    if (search.trim() && matchingNodeIds.size > 0) {
      const newExpanded = new Set(expandedNodeIds);
      const newExpandedUnits = new Set(expandedUnitCodes);
      matchingNodeIds.forEach((matchedId) => {
        let curr = nodeMap.get(matchedId);
        if (curr) newExpandedUnits.add(curr.unitCode);
        while (curr && curr.immediateSupervisorId) {
          newExpanded.add(curr.immediateSupervisorId);
          curr = nodeMap.get(curr.immediateSupervisorId);
        }
      });
      setExpandedNodeIds(newExpanded);
      setExpandedUnitCodes(newExpandedUnits);
    }
  }, [search, matchingNodeIds, nodeMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Children Map (Direct Reports by Supervisor ID)
  const childrenMap = useMemo(() => {
    const map = new Map<string, OrgNodeData[]>();
    nodes.forEach((node) => {
      if (node.immediateSupervisorId) {
        const parentId = node.immediateSupervisorId;
        if (!map.has(parentId)) map.set(parentId, []);
        map.get(parentId)!.push(node);
      }
    });
    return map;
  }, [nodes]);

  // Unit Grouping
  const unitGroups = useMemo(() => {
    const byUnit = new Map<string, OrgNodeData[]>();
    nodes.forEach((n) => {
      if (!byUnit.has(n.unitCode)) byUnit.set(n.unitCode, []);
      byUnit.get(n.unitCode)!.push(n);
    });
    return byUnit;
  }, [nodes]);

  // Toggle Handlers
  const toggleUnit = (code: string) => {
    setExpandedUnitCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const toggleNode = (id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedUnitCodes(new Set(UNIT_ORDER));
    const allIds = new Set<string>();
    nodes.forEach((n) => allIds.add(n.id));
    setExpandedNodeIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedUnitCodes(new Set());
    setExpandedNodeIds(new Set());
  };

  const handleOpenAssignSupervisor = (emp: OrgNodeData) => {
    setActiveTargetEmployee(emp);
    setIsSupervisorDialogOpen(true);
  };

  // Visible Units
  const visibleUnitCodes = useMemo(() => {
    if (selectedUnit === "ALL") {
      return UNIT_ORDER.filter((code) => unitGroups.has(code));
    }
    const unitObj = units.find((u) => u.id === selectedUnit);
    if (unitObj) return [unitObj.code];
    return [];
  }, [selectedUnit, unitGroups, units]);

  // Lines are recalculated whenever the chart's layout can have changed.
  const pageLayoutKey = useMemo(
    () => `${[...expandedUnitCodes].sort().join(",")}|${[...expandedNodeIds].sort().join(",")}|${nodes.length}|${showOversight}`,
    [expandedUnitCodes, expandedNodeIds, nodes.length, showOversight]
  );

  // Audit Node Counts
  const auditCounts = useMemo(() => {
    const activeDbCount = nodes.filter(n => !n.isArchived).length;
    const assignedCount = nodes.filter(n => n.supervisorAssignmentStatus === "ASSIGNED" || n.supervisorAssignmentStatus === "OVERRIDDEN").length;
    const pendingCountCalc = nodes.filter(n => n.supervisorAssignmentStatus === "PENDING").length;
    const unassignedCountCalc = nodes.filter(n => n.supervisorAssignmentStatus === "UNASSIGNED").length;
    return { activeDbCount, assignedCount, pendingCountCalc, unassignedCountCalc };
  }, [nodes]);

  return (
    <OversightProvider show={showOversight} data={oversight} people={oversightPeople}>
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
              Organizational Chart
            </h1>
            <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200 text-xs dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900">
              Live Structure
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visual hierarchy and reporting structure of Hospicio de San Jose
          </p>
        </div>

        {/* Action Controls & Audit Stats */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsFullscreen(true)}
            className="no-pan bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
          >
            <Maximize2 className="h-4 w-4" /> Fullscreen Workspace
          </Button>

          <div className="bg-surface border border-border rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600 dark:text-primary-300" />
            <span className="text-xs text-muted-foreground">Active Employees:</span>
            <span className="text-xs font-bold text-foreground">{auditCounts.activeDbCount}</span>
          </div>

          <div className="bg-status-success-surface border border-status-success-border rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-2 dark:bg-status-success-surface dark:border-status-success-border">
            <CheckCircle2 className="h-4 w-4 text-success dark:text-status-success-foreground" />
            <span className="text-xs text-status-success-foreground font-semibold dark:text-status-success-foreground">Assigned:</span>
            <span className="text-xs font-bold text-status-success-foreground dark:text-status-success-foreground">{auditCounts.assignedCount}</span>
          </div>

          {auditCounts.pendingCountCalc > 0 && (
            <div className="bg-status-warning-surface border border-status-warning-border rounded-xl px-3 py-1.5 shadow-sm flex items-center gap-2 dark:bg-status-warning-surface dark:border-status-warning-border">
              <AlertTriangle className="h-4 w-4 text-warning dark:text-status-warning-foreground" />
              <span className="text-xs text-status-warning-foreground font-semibold dark:text-status-warning-foreground">Pending Above:</span>
              <span className="text-xs font-bold text-status-warning-foreground dark:text-status-warning-foreground">{auditCounts.pendingCountCalc}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar & Filters ──────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, employee #, role, unit, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="no-pan w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-surface"
            />
            {search && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-semibold dark:text-primary-300">
                {matchingNodeIds.size} matched
              </span>
            )}
          </div>

          {/* Unit Filter */}
          <div className="w-full lg:w-52">
            <select
              value={selectedUnit}
              onChange={(e) => { setSelectedUnit(e.target.value); setSelectedDept("ALL"); }}
              className="no-pan w-full py-2 px-3 text-xs border border-border rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-surface"
            >
              <option value="ALL">All Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          {availableDepartments.length > 0 && (
            <div className="w-full lg:w-48">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="no-pan w-full py-2 px-3 text-xs border border-border rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-surface"
              >
                <option value="ALL">All Departments</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="w-full lg:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="no-pan w-full py-2 px-3 text-xs border border-border rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-surface"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Assigned Only</option>
              <option value="PENDING">Pending Only</option>
            </select>
          </div>

          {/* Archived Filter */}
          <div className="w-full lg:w-36">
            <select
              value={isArchivedFilter}
              onChange={(e) => setIsArchivedFilter(e.target.value)}
              className="no-pan w-full py-2 px-3 text-xs border border-border rounded-lg focus:ring-1 focus:ring-primary-500 focus:outline-none bg-surface"
            >
              <option value="false">Active Only</option>
              <option value="true">Archived Only</option>
              <option value="all">All Records</option>
            </select>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExpandAll} className="no-pan h-7 text-xs gap-1">
              <Maximize2 className="h-3.5 w-3.5" /> Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={handleCollapseAll} className="no-pan h-7 text-xs gap-1">
              <Minimize2 className="h-3.5 w-3.5" /> Collapse All
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchOrgChart} className="no-pan h-7 text-xs gap-1 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <OversightToggle checked={showOversight} onChange={setShowOversight} />
            {isFullHR && (
              <Button variant="outline" size="sm" onClick={() => setIsOversightDialogOpen(true)} className="no-pan h-7 text-xs gap-1">
                <Eye className="h-3.5 w-3.5" /> Manage Additional Oversight
              </Button>
            )}
          </div>
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{nodes.length}</strong> active DEV employees across <strong className="text-foreground">{visibleUnitCodes.length}</strong> units
          </span>
        </div>
      </div>

      {/* ── Main Accordion View ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-3 shadow-sm">
          <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Building Organizational Structure...</p>
        </div>
      ) : hasError ? (
        <div className="bg-surface border border-status-danger-border rounded-xl p-8 text-center space-y-3 shadow-sm dark:border-status-danger-border">
          <AlertTriangle className="h-10 w-10 text-danger mx-auto" />
          <h3 className="text-base font-bold text-foreground">Failed to Load Organizational Chart</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            An error occurred while communicating with the server.
          </p>
          <Button size="sm" onClick={fetchOrgChart} className="mt-2">Retry Loading</Button>
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-3 shadow-sm">
          <Users className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">No Employees Found</h3>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Master Root Node */}
          <div className="flex flex-col items-center mb-2">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl px-6 py-3 shadow-lg border border-primary-500 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="h-7 w-7 rounded-full bg-surface/20 flex items-center justify-center">
                  <Heart className="h-3.5 w-3.5 text-white" fill="white" />
                </div>
                <h2 className="text-base font-bold font-heading leading-tight">Hospicio de San Jose</h2>
              </div>
              <p className="text-xs text-primary-100 font-medium mt-0.5">Primary Organizational Root</p>
            </div>
            <div className="h-5 w-0.5 bg-primary-300" />
            <div className="w-full max-w-6xl h-0.5 bg-primary-200 mx-auto dark:bg-primary-900/60" />
          </div>

          <OversightSummary />

          {/* Unit Accordions */}
          <div ref={pageTreeRef} className="space-y-4 relative">
            <OversightLines containerRef={pageTreeRef} mode="page" stroke="var(--color-primary-500)" layoutKey={pageLayoutKey} />
            {visibleUnitCodes.map((unitCode) => {
              const unitNodes = unitGroups.get(unitCode) || [];
              const meta = UNIT_META[unitCode] || {
                color: "text-foreground", bg: "bg-muted", border: "border-border", label: unitCode
              };
              const isExpanded = expandedUnitCodes.has(unitCode);

              return (
                <UnitBranch
                  key={unitCode}
                  unitCode={unitCode}
                  unitLabel={meta.label}
                  unitNodes={unitNodes}
                  meta={meta}
                  isExpanded={isExpanded}
                  onToggle={() => toggleUnit(unitCode)}
                  childrenMap={childrenMap}
                  expandedNodeIds={expandedNodeIds}
                  onToggleNode={toggleNode}
                  matchingNodeIds={matchingNodeIds}
                  onOpenAssignSupervisor={handleOpenAssignSupervisor}
                  isFullHR={isFullHR}
                  navigate={navigate}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fullscreen Workspace View ────────────────────────────────────────── */}
      {isFullscreen && (
        <FullscreenOrgChartWorkspace
          nodes={nodes}
          childrenMap={childrenMap}
          unitGroups={unitGroups}
          units={units}
          visibleUnitCodes={visibleUnitCodes}
          expandedNodeIds={expandedNodeIds}
          onToggleNode={toggleNode}
          matchingNodeIds={matchingNodeIds}
          onOpenAssignSupervisor={handleOpenAssignSupervisor}
          isFullHR={isFullHR}
          navigate={navigate}
          onClose={() => setIsFullscreen(false)}
          search={search}
          setSearch={setSearch}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          fullscreenMode={fullscreenMode}
          setFullscreenMode={setFullscreenMode}
          fetchOrgChart={fetchOrgChart}
          showOversight={showOversight}
          setShowOversight={setShowOversight}
          oversight={oversight}
          oversightPeople={oversightPeople}
        />
      )}

      {/* ── Supervisor Assignment Dialog ────────────────────────────────────── */}
      {isSupervisorDialogOpen && activeTargetEmployee && (
        <SupervisorAssignmentDialog
          isOpen={isSupervisorDialogOpen}
          onClose={() => {
            setIsSupervisorDialogOpen(false);
            setActiveTargetEmployee(null);
          }}
          employeeId={activeTargetEmployee.id}
          currentSupervisorId={activeTargetEmployee.immediateSupervisorId || undefined}
          onAssignmentSuccess={() => {
            setIsSupervisorDialogOpen(false);
            setActiveTargetEmployee(null);
            fetchOrgChart();
          }}
        />
      )}

      {/* ── Additional Oversight (HR) ───────────────────────────────────────── */}
      {isFullHR && (
        <AdditionalOversightDialog
          open={isOversightDialogOpen}
          onOpenChange={setIsOversightDialogOpen}
          onChanged={refreshOversight}
        />
      )}
    </div>
    </OversightProvider>
  );
}

// ─── Unit Branch Component (Normal Page Accordion) ────────────────────────────

interface UnitBranchProps {
  unitCode: string;
  unitLabel: string;
  unitNodes: OrgNodeData[];
  meta: { color: string; bg: string; border: string };
  isExpanded: boolean;
  onToggle: () => void;
  childrenMap: Map<string, OrgNodeData[]>;
  expandedNodeIds: Set<string>;
  onToggleNode: (id: string) => void;
  matchingNodeIds: Set<string>;
  onOpenAssignSupervisor: (node: OrgNodeData) => void;
  isFullHR: boolean;
  navigate: any;
}

function UnitBranch({
  unitCode, unitLabel, unitNodes, meta, isExpanded, onToggle,
  childrenMap, expandedNodeIds, onToggleNode,
  matchingNodeIds, onOpenAssignSupervisor, isFullHR, navigate
}: UnitBranchProps) {

  const unitNodeIds = useMemo(() => new Set(unitNodes.map(n => n.id)), [unitNodes]);

  const { treeRoots, unassignedNodes } = useMemo(() => {
    const roots: OrgNodeData[] = [];
    const unassigned: OrgNodeData[] = [];

    unitNodes.forEach((node) => {
      const supInUnit = node.immediateSupervisorId && unitNodeIds.has(node.immediateSupervisorId);

      if (supInUnit) return;

      const hasChildren = (childrenMap.get(node.id) || []).length > 0;

      if (unitCode === "FIN" || (!hasChildren && node.supervisorAssignmentStatus === "PENDING" && node.directReportCount === 0 && !node.parentJobRoleId)) {
        unassigned.push(node);
      } else {
        roots.push(node);
      }
    });

    return { treeRoots: roots, unassignedNodes: unassigned };
  }, [unitNodes, unitNodeIds, childrenMap, unitCode]);

  const totalEmployees = unitNodes.length;
  const pendingCount = unitNodes.filter(n => n.supervisorAssignmentStatus === "PENDING").length;
  const assignedCount = unitNodes.filter(n => n.supervisorAssignmentStatus === "ASSIGNED" || n.supervisorAssignmentStatus === "OVERRIDDEN").length;

  return (
    <div className={cn("hrisense-surface", meta.border)}>
      {/* Accordion Header */}
      <button
        onClick={onToggle}
        className={cn(
          "no-pan w-full flex items-center justify-between px-5 py-3.5 transition-colors",
          meta.bg,
          "hover:brightness-95"
        )}
      >
        <div className="flex items-center gap-3">
          <Building2 className={cn("h-5 w-5", meta.color)} />
          <div className="text-left">
            <h3 className={cn("text-sm font-bold font-heading", meta.color)}>{unitLabel}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalEmployees} employee{totalEmployees !== 1 ? "s" : ""} • {assignedCount} assigned
              {pendingCount > 0 && <span className="text-warning font-semibold ml-1.5 dark:text-status-warning-foreground">• {pendingCount} pending higher sup</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="outline" className="bg-status-warning-surface text-status-warning-foreground border-status-warning-border text-[10px] dark:bg-status-warning-surface dark:text-status-warning-foreground dark:border-status-warning-border">
              {pendingCount} Pending Above
            </Badge>
          )}
          {isExpanded
            ? <ChevronUp className={cn("h-4 w-4", meta.color)} />
            : <ChevronDown className={cn("h-4 w-4", meta.color)} />
          }
        </div>
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-6 space-y-8 overflow-x-auto" data-oversight-clip>

          {/* Tree Branches */}
          {treeRoots.length > 0 && (
            <div className="flex justify-center gap-12 items-start min-w-max pb-4 mx-auto">
              {treeRoots.map((root) => (
                <OrgChartPyramidBranch
                  key={root.id}
                  node={root}
                  childrenMap={childrenMap}
                  expandedNodeIds={expandedNodeIds}
                  onToggleExpand={onToggleNode}
                  matchingNodeIds={matchingNodeIds}
                  onOpenAssignSupervisor={onOpenAssignSupervisor}
                  isFullHR={isFullHR}
                  visitedPath={new Set()}
                  navigate={navigate}
                  unitNodeIds={unitNodeIds}
                />
              ))}
            </div>
          )}

          {/* Dedicated Unassigned Section */}
          {unassignedNodes.length > 0 && (
            <div className="border border-border rounded-xl bg-muted/80 p-4 space-y-3 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-1">
                <UserX className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-foreground">
                  Unassigned Supervisor Roles ({unassignedNodes.length})
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  — No confirmed parent supervisor role
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {unassignedNodes.map((emp) => (
                  <UnassignedEmployeeCard
                    key={emp.id}
                    emp={emp}
                    isFullHR={isFullHR}
                    onOpenAssignSupervisor={onOpenAssignSupervisor}
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          )}

          {treeRoots.length === 0 && unassignedNodes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No employees in this unit.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Unassigned Card Component ────────────────────────────────────────────────

function UnassignedEmployeeCard({ emp, isFullHR, onOpenAssignSupervisor, navigate }: {
  emp: OrgNodeData; isFullHR: boolean; onOpenAssignSupervisor: (node: OrgNodeData) => void; navigate: any;
}) {
  const oversightCtx = useOversight();
  return (
    <div ref={(el) => oversightCtx?.register(emp.id, el)} className="no-pan bg-surface border border-border rounded-xl p-3 shadow-sm flex flex-col justify-between space-y-2">
      <div className="flex items-start gap-2.5">
        <ProtectedImage
          src={emp.photoUrl}
          alt={emp.fullName}
          className="h-8 w-8 rounded-full object-cover shrink-0 border border-border"
          fallback={(
            <div className="h-8 w-8 rounded-full bg-muted text-foreground font-bold text-xs flex items-center justify-center shrink-0 border border-border">
              {emp.firstName[0]}{emp.lastName[0]}
            </div>
          )}
        />
        <div className="min-w-0 flex-1">
          <p onClick={() => navigate({ to: `/employees/${emp.id}` as any })} className="text-xs font-bold text-foreground truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-300">
            {emp.fullName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{emp.jobRoleTitle}</p>
          {isProfessional(emp) && (
            <span
              className="mt-1 inline-flex items-center rounded border border-status-info-border bg-status-info-surface px-1.5 py-0.5 text-[9px] font-semibold text-status-info-foreground"
              title={emp.professionalRole ? `Professional — ${emp.professionalRole}` : "Professional"}
            >
              Professional
            </span>
          )}
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{emp.employeeNumber}</p>
          <OversightCardBadge nodeId={emp.id} immediateSupervisorId={emp.immediateSupervisorId} />
        </div>
      </div>
      <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] px-1.5 py-0">
          No Confirmed Supervisor Role
        </Badge>
        {isFullHR && (
          <Button size="xs" variant="create" onClick={() => onOpenAssignSupervisor(emp)} className="no-pan">
            Assign
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Visual Pyramid Tree Branch Component ─────────────────────────────────────

interface PyramidBranchProps {
  node: OrgNodeData;
  childrenMap: Map<string, OrgNodeData[]>;
  expandedNodeIds: Set<string>;
  onToggleExpand: (id: string) => void;
  matchingNodeIds: Set<string>;
  onOpenAssignSupervisor: (node: OrgNodeData) => void;
  isFullHR: boolean;
  visitedPath: Set<string>;
  navigate: any;
  unitNodeIds: Set<string>;
  onConnectorCountUpdate?: (count: number) => void;
}

function OrgChartPyramidBranch({
  node, childrenMap, expandedNodeIds, onToggleExpand, matchingNodeIds,
  onOpenAssignSupervisor, isFullHR, visitedPath, navigate, unitNodeIds, onConnectorCountUpdate
}: PyramidBranchProps) {

  const branchContainerRef = useRef<HTMLDivElement>(null);
  const parentCardRef = useRef<HTMLDivElement>(null);
  const childCardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const oversightCtx = useOversight();

  // Clean stale ref map on unmount
  useEffect(() => {
    const refsMap = childCardRefs.current;
    return () => {
      refsMap.clear();
    };
  }, []);

  // Cycle guard
  if (visitedPath.has(node.id)) {
    return (
      <div className="p-2 bg-status-danger-surface border border-status-danger-border rounded-xl text-status-danger-foreground text-xs my-1 w-56 text-center dark:bg-status-danger-surface dark:border-status-danger-border dark:text-status-danger-foreground">
        Cycle: {node.fullName} ({node.employeeNumber})
      </div>
    );
  }

  const nextVisited = new Set(visitedPath);
  nextVisited.add(node.id);

  const rawChildren = childrenMap.get(node.id) || [];
  const children = rawChildren.filter(c => unitNodeIds.has(c.id));
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);
  const isMatched = matchingNodeIds.has(node.id);

  // Status Badge Logic.
  // Deliberately NOT a hook: this component returns early above when a
  // supervisor cycle is detected, and a hook after that early return means React
  // renders a different number of hooks for a cyclic node and throws. The badge
  // is a handful of comparisons, so there is nothing to memoise.
  const statusBadge = (() => {
    if (node.noSupervisorRequired && node.supervisorAssignmentSource !== "MANUAL_OVERRIDE") {
      return <Badge variant="outline" className="bg-status-accent-surface text-status-accent-foreground border-status-accent-border text-[9px] dark:bg-status-accent-surface dark:text-status-accent-foreground dark:border-status-accent-border">No Supervisor Required</Badge>;
    }
    if (node.supervisorAssignmentSource === "MANUAL_OVERRIDE") {
      return <Badge variant="outline" className="bg-status-neutral-surface text-status-neutral-foreground border-status-neutral-border text-[9px] dark:bg-status-info-surface dark:text-status-info-foreground dark:border-status-info-border">Manual Override</Badge>;
    }
    if (node.supervisorAssignmentStatus === "PENDING" || node.immediateSupervisorId === null) {
      if (node.unitCode === "FIN") {
        return <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px]">No Confirmed Supervisor Role</Badge>;
      }
      return <Badge variant="outline" className="bg-status-warning-surface text-status-warning-foreground border-status-warning-border text-[9px] dark:bg-status-warning-surface dark:text-status-warning-foreground dark:border-status-warning-border">Top Role — Higher Sup Unconfirmed</Badge>;
    }
    return <Badge variant="outline" className="bg-status-success-surface text-status-success-foreground border-status-success-border text-[9px] dark:bg-status-success-surface dark:text-status-success-foreground dark:border-status-success-border">Assigned</Badge>;
  })();

  return (
    <div ref={branchContainerRef} className="flex flex-col items-center relative min-w-max">

      {/* Dynamic SVG Connector Overlay for this Branch */}
      {hasChildren && isExpanded && (
        <SVGTreeConnector
          parentRef={parentCardRef}
          childrenRefs={childCardRefs}
          childrenNodes={children}
          containerRef={branchContainerRef}
          onPathsCalculated={onConnectorCountUpdate}
        />
      )}

      {/* Parent Node Card */}
      <div
        ref={(el) => {
          parentCardRef.current = el;
          oversightCtx?.register(node.id, el);
        }}
        className={cn(
          "no-pan bg-surface border rounded-2xl p-3.5 shadow-sm w-64 transition-all duration-150 relative z-10",
          isMatched
            ? "border-warning ring-2 ring-status-warning-border bg-status-warning-surface/20 dark:bg-status-warning-surface/20"
            : "border-border hover:border-primary-400",
          node.isArchived && "opacity-60 bg-muted"
        )}
      >
        {/* Header Badges */}
        <div className="flex items-center justify-between mb-2 gap-1 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5",
              node.permissionTier === "FULL" && "bg-status-accent-surface text-status-accent-foreground border-status-accent-border dark:bg-status-accent-surface dark:text-status-accent-foreground dark:border-status-accent-border",
              node.permissionTier === "SUPERVISOR" && "bg-status-neutral-surface text-status-neutral-foreground border-status-neutral-border dark:bg-status-info-surface dark:text-status-info-foreground dark:border-status-info-border",
              node.permissionTier === "STANDARD" && "bg-muted text-foreground border-border"
            )}
          >
            {node.permissionTier}
          </Badge>
          {statusBadge}
        </div>

        {/* Employee Info */}
        <div className="flex items-start gap-3">
          <ProtectedImage
            src={node.photoUrl}
            alt={node.fullName}
            className="h-9 w-9 rounded-full object-cover shrink-0 border border-primary-100 dark:border-primary-900"
            fallback={(
              <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0 border border-primary-200 dark:bg-primary-900/60 dark:text-primary-300 dark:border-primary-900">
                {node.firstName[0]}{node.lastName[0]}
              </div>
            )}
          />
          <div className="min-w-0 flex-1">
            <h4
              onClick={() => navigate({ to: `/employees/${node.id}` as any })}
              className="text-xs font-bold text-foreground leading-tight truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-300"
            >
              {node.fullName}
            </h4>
            <p className="text-[11px] font-medium text-primary-700 truncate mt-0.5 dark:text-primary-300">{node.jobRoleTitle}</p>
            {/* A PRC licence on file is what marks someone as a professional. */}
            {isProfessional(node) && (
              <span
                className="mt-1 inline-flex items-center rounded border border-status-info-border bg-status-info-surface px-1.5 py-0.5 text-[9px] font-semibold text-status-info-foreground"
                title={node.professionalRole ? `Professional — ${node.professionalRole}` : "Professional"}
              >
                Professional
              </span>
            )}
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {node.unitName}{node.departmentName ? ` • ${node.departmentName}` : ""}
            </p>
          </div>
        </div>

        {/* Additional oversight (only while it is shown) */}
        <OversightCardBadge nodeId={node.id} immediateSupervisorId={node.immediateSupervisorId} />

        {/* Card Footer */}
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">{node.employeeNumber}</span>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => navigate({ to: `/employees/${node.id}` as any })}
              className="no-pan text-primary-600 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/40"
            >
              Profile
            </Button>
            {isFullHR && !node.noSupervisorRequired && node.supervisorAssignmentStatus === "PENDING" && (
              <Button
                size="xs"
                variant="create"
                onClick={() => onOpenAssignSupervisor(node)}
                className="no-pan font-semibold">
                Assign
              </Button>
            )}
          </div>
        </div>

        {/* Direct Reports Expand Button */}
        {hasChildren && (
          <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => onToggleExpand(node.id)}
              className={cn(
                "no-pan flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border transition-all cursor-pointer",
                isExpanded
                  ? "bg-primary-600 text-white border-primary-700 hover:bg-primary-700"
                  : "bg-surface text-primary-700 border-primary-300 hover:bg-primary-50 dark:text-primary-300 dark:border-primary-900 dark:hover:bg-primary-900/40"
              )}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>{children.length} Direct</span>
            </button>
          </div>
        )}
      </div>

      {/* Child Tree Branches */}
      {hasChildren && isExpanded && (
        <div className="flex justify-center items-start pt-10 px-2 gap-8 min-w-max relative z-10">
          {children.map((child) => (
            <div
              key={child.id}
              ref={(el) => {
                if (el) childCardRefs.current.set(child.id, el);
                else childCardRefs.current.delete(child.id);
              }}
              className="flex flex-col items-center min-w-max"
            >
              <OrgChartPyramidBranch
                node={child}
                childrenMap={childrenMap}
                expandedNodeIds={expandedNodeIds}
                onToggleExpand={onToggleExpand}
                matchingNodeIds={matchingNodeIds}
                onOpenAssignSupervisor={onOpenAssignSupervisor}
                isFullHR={isFullHR}
                visitedPath={nextVisited}
                navigate={navigate}
                unitNodeIds={unitNodeIds}
                onConnectorCountUpdate={onConnectorCountUpdate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fullscreen Workspace Component ───────────────────────────────────────────

interface FullscreenProps {
  nodes: OrgNodeData[];
  childrenMap: Map<string, OrgNodeData[]>;
  unitGroups: Map<string, OrgNodeData[]>;
  units: { id: string; name: string; code: string }[];
  visibleUnitCodes: string[];
  expandedNodeIds: Set<string>;
  onToggleNode: (id: string) => void;
  matchingNodeIds: Set<string>;
  onOpenAssignSupervisor: (node: OrgNodeData) => void;
  isFullHR: boolean;
  navigate: any;
  onClose: () => void;
  search: string;
  setSearch: (s: string) => void;
  selectedUnit: string;
  setSelectedUnit: (u: string) => void;
  fullscreenMode: "FULL_ORG" | "UNIT";
  setFullscreenMode: (m: "FULL_ORG" | "UNIT") => void;
  fetchOrgChart: () => void;
  showOversight: boolean;
  setShowOversight: (v: boolean) => void;
  oversight: OversightData;
  oversightPeople: Map<string, OversightPerson>;
}

function FullscreenOrgChartWorkspace({
  nodes, childrenMap, unitGroups, units, visibleUnitCodes,
  expandedNodeIds, onToggleNode, matchingNodeIds, onOpenAssignSupervisor,
  isFullHR, navigate, onClose, search, setSearch, selectedUnit, setSelectedUnit,
  fullscreenMode, setFullscreenMode, fetchOrgChart,
  showOversight, setShowOversight, oversight, oversightPeople
}: FullscreenProps) {

  const workspaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const masterRootRef = useRef<HTMLDivElement>(null);
  const unitCardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Clean stale ref map on unmount
  useEffect(() => {
    const refsMap = unitCardRefs.current;
    return () => {
      refsMap.clear();
    };
  }, []);

  // ── Authoritative Canvas Transform State ────────────────────────────────────
  const [scale, setScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number } | null>(null);

  // Manual zoom protection flag — prevents auto-fit from immediately overwriting user zoom
  const userHasManuallyZoomedRef = useRef<boolean>(false);

  // Dev Diagnostics Panel State
  const [showDevPanel, setShowDevPanel] = useState<boolean>(true);
  const [rootToUnitCount, setRootToUnitCount] = useState<number>(0);
  const [employeePathCount, setEmployeePathCount] = useState<number>(0);

  // Calculate Expected Employee Connector Count from dataset
  const expectedEmployeeConnectors = useMemo(() => {
    const activeNodeIds = new Set(nodes.filter(n => !n.isArchived).map(n => n.id));
    let count = 0;
    nodes.forEach(n => {
      if (!n.isArchived && n.immediateSupervisorId && activeNodeIds.has(n.immediateSupervisorId)) {
        count++;
      }
    });
    return count;
  }, [nodes]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ── Pointer Drag Handlers ──────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.no-pan, button, input, select, a, [role="button"]')) {
      return;
    }
    if (e.button !== 0) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: panOffset.x,
      initialPanY: panOffset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // The browser already released the capture (e.g. the pointer left the
        // window); there is nothing left to undo.
      }
    }
  };

  // Wheel Pan Handler (Normal wheel pans canvas smoothly)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setPanOffset((prev) => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  };

  // ── Authoritative Fit to Screen Calculation ─────────────────────────────────
  const handleFitScreen = useCallback(() => {
    if (!workspaceRef.current || !contentRef.current) return;

    const wsWidth = workspaceRef.current.clientWidth;
    const wsHeight = workspaceRef.current.clientHeight;

    // Unscaled content dimensions from unconstrained DOM layout
    const contentWidth = contentRef.current.scrollWidth || contentRef.current.offsetWidth;
    const contentHeight = contentRef.current.scrollHeight || contentRef.current.offsetHeight;

    if (wsWidth <= 0 || wsHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return;

    const padding = 80;
    const availableW = Math.max(100, wsWidth - padding);
    const availableH = Math.max(100, wsHeight - padding);

    const scaleX = availableW / contentWidth;
    const scaleY = availableH / contentHeight;

    const rawFit = Math.min(scaleX, scaleY);
    // Clamp fit scale safely between 0.25 and 1.20
    const calculatedScale = Number(Math.min(1.2, Math.max(0.25, rawFit)).toFixed(2));

    const scaledWidth = contentWidth * calculatedScale;
    const scaledHeight = contentHeight * calculatedScale;

    const centeredX = (wsWidth - scaledWidth) / 2;
    const centeredY = Math.max(40, (wsHeight - scaledHeight) / 2);

    setScale(calculatedScale);
    setPanOffset({ x: centeredX, y: centeredY });
  }, []);

  // Explicit user Fit to Screen button action
  const handleExplicitFitScreen = () => {
    userHasManuallyZoomedRef.current = false;
    handleFitScreen();
  };

  // Zoom Button Controls (Sets userHasManuallyZoomedRef = true)
  const handleZoomIn = () => {
    userHasManuallyZoomedRef.current = true;
    setScale((s) => Number(Math.min(2.0, s + 0.10).toFixed(2)));
  };

  const handleZoomOut = () => {
    userHasManuallyZoomedRef.current = true;
    setScale((s) => Number(Math.max(0.25, s - 0.10).toFixed(2)));
  };

  // Reset Zoom (100% scale and centered)
  const handleResetZoom = () => {
    userHasManuallyZoomedRef.current = true;
    if (workspaceRef.current && contentRef.current) {
      const wsWidth = workspaceRef.current.clientWidth;
      const contentWidth = contentRef.current.scrollWidth || contentRef.current.offsetWidth;
      const centeredX = (wsWidth - contentWidth) / 2;
      setPanOffset({ x: Math.max(20, centeredX), y: 40 });
    } else {
      setPanOffset({ x: 0, y: 40 });
    }
    setScale(1.0);
  };

  // Mode or Unit change resets manual flag and auto-fits
  useEffect(() => {
    userHasManuallyZoomedRef.current = false;
    unitCardRefs.current.clear();
    const timer = setTimeout(() => {
      handleFitScreen();
    }, 120);
    return () => clearTimeout(timer);
  }, [fullscreenMode, selectedUnit, handleFitScreen]);

  // ResizeObserver on workspace viewport container — only fits if user hasn't manually zoomed
  useEffect(() => {
    if (!workspaceRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!userHasManuallyZoomedRef.current) {
        handleFitScreen();
      }
    });
    observer.observe(workspaceRef.current);
    return () => observer.disconnect();
  }, [handleFitScreen]);

  // Live Measurements for Dev Panel & Evidence Report
  const liveStats = useMemo(() => {
    const wsW = workspaceRef.current?.clientWidth || 0;
    const wsH = workspaceRef.current?.clientHeight || 0;
    const cW = contentRef.current ? (contentRef.current.scrollWidth || contentRef.current.offsetWidth) : 0;
    const cH = contentRef.current ? (contentRef.current.scrollHeight || contentRef.current.offsetHeight) : 0;
    const sX = cW > 0 ? (wsW - 80) / cW : 0;
    const sY = cH > 0 ? (wsH - 80) / cH : 0;
    const fit = Math.min(sX, sY);

    return { wsW, wsH, cW, cH, sX, sY, fit };
  }, [scale, panOffset, fullscreenMode, selectedUnit]);

  const canvasLayoutKey = `${fullscreenMode}|${selectedUnit}|${[...expandedNodeIds].sort().join(",")}|${nodes.length}|${showOversight}`;

  return (
    <OversightProvider show={showOversight} data={oversight} people={oversightPeople}>
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">

      {/* Top Controls Bar */}
      <div className="no-pan bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 z-30 shadow-md">
        
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center font-bold text-white shadow-sm">
            <Heart className="h-4 w-4 fill-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-heading">Org Chart Workspace</h2>
            <p className="text-[11px] text-muted-foreground">Full Pyramid Tree Workspace</p>
          </div>

          {/* Mode Switcher */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1 ml-4">
            <button
              onClick={() => setFullscreenMode("FULL_ORG")}
              className={cn(
                "no-pan px-3 py-1 text-xs rounded-md font-medium transition-all",
                fullscreenMode === "FULL_ORG" ? "bg-primary-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              )}
            >
              <Layers className="h-3.5 w-3.5 inline mr-1.5" /> Full Organization
            </button>
            <button
              onClick={() => setFullscreenMode("UNIT")}
              className={cn(
                "no-pan px-3 py-1 text-xs rounded-md font-medium transition-all",
                fullscreenMode === "UNIT" ? "bg-primary-600 text-white shadow-sm" : "text-muted-foreground hover:text-white"
              )}
            >
              <Building2 className="h-3.5 w-3.5 inline mr-1.5" /> Selected Unit
            </button>
          </div>
        </div>

        {/* Search & Unit Filter */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="no-pan w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="no-pan py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            <option value="ALL">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-lg flex items-center p-0.5">
            <Button size="sm" variant="ghost" onClick={handleZoomOut} className="no-pan h-7 w-7 p-0 text-slate-300 hover:text-white" title="Zoom Out (-10%)">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono px-2 text-slate-300 min-w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} className="no-pan h-7 w-7 p-0 text-slate-300 hover:text-white" title="Zoom In (+10%)">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleResetZoom} className="no-pan h-7 w-7 p-0 text-slate-300 hover:text-white" title="Reset Zoom (100%)">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button size="sm" variant="outline" onClick={handleExplicitFitScreen} className="no-pan h-8 text-xs bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-900 gap-1.5">
            <Target className="h-3.5 w-3.5" /> Fit Screen
          </Button>

          <OversightToggle checked={showOversight} onChange={setShowOversight} dark />

          <Button size="sm" variant="ghost" onClick={() => setShowDevPanel(prev => !prev)} className="no-pan h-8 w-8 p-0 text-muted-foreground hover:text-white" title="Toggle Dev Diagnostics">
            <Terminal className="h-3.5 w-3.5" />
          </Button>

          <Button size="sm" variant="ghost" onClick={fetchOrgChart} className="no-pan h-8 text-xs text-muted-foreground hover:text-white" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="no-pan h-8 bg-danger/80 hover:bg-danger text-white font-semibold text-xs gap-1"
          >
            <X className="h-4 w-4" /> Exit Fullscreen
          </Button>
        </div>
      </div>

      {/* Temporary Development Diagnostics Overlay Panel */}
      {showDevPanel && (
        <div className="no-pan fixed bottom-4 right-4 z-40 bg-slate-900/95 border border-slate-700 text-slate-200 rounded-xl p-3.5 shadow-2xl font-mono text-[11px] max-w-sm space-y-1.5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-warning flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> Dev Diagnostics
            </span>
            <button onClick={() => setShowDevPanel(false)} className="text-muted-foreground hover:text-white text-xs">✕</button>
          </div>
          <div>Mode: <strong className="text-white">{fullscreenMode}</strong> | Selected Unit: <strong className="text-white">{selectedUnit}</strong></div>
          <div>Scale State: <strong className="text-success">{(scale * 100).toFixed(0)}% ({scale})</strong></div>
          <div>Translate: <strong className="text-slate-300">({panOffset.x.toFixed(0)}, {panOffset.y.toFixed(0)})</strong></div>
          <div>Viewport: <strong className="text-slate-300">{liveStats.wsW} × {liveStats.wsH}</strong></div>
          <div>Content: <strong className="text-slate-300">{liveStats.cW} × {liveStats.cH}</strong></div>
          <div>Calculated scaleX / Y: <strong className="text-slate-300">{liveStats.sX.toFixed(2)} / {liveStats.sY.toFixed(2)}</strong></div>
          <div>Calculated fitScale: <strong className="text-status-warning-border">{liveStats.fit.toFixed(2)}</strong></div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-muted-foreground">
            <div>Active Employees: {nodes.length}</div>
            <div>Expected Employee Connectors: {expectedEmployeeConnectors}</div>
            <div>Root-to-Unit Connectors: {rootToUnitCount}</div>
            <div>Manual Zoom Lock Active: {userHasManuallyZoomedRef.current ? "YES (protected)" : "NO"}</div>
          </div>
        </div>
      )}

      {/* Pointer Pan Workspace Canvas */}
      <div
        ref={workspaceRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className={cn(
          "flex-1 relative overflow-hidden bg-slate-950 transition-colors",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* Canvas Background Hint */}
        <div className="absolute bottom-4 left-6 z-20 flex items-center gap-2 pointer-events-none text-muted-foreground text-xs bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <Move className="h-3.5 w-3.5" />
          <span>Click & Drag to pan</span>
        </div>

        {showOversight && (
          <div className="absolute top-3 left-6 z-20 pointer-events-none rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5">
            <OversightLegend dark />
            <span className="ml-3 text-[11px] text-slate-400">{oversight.links.length} additional oversight line{oversight.links.length === 1 ? "" : "s"}</span>
          </div>
        )}

        {/* Transformed Content Container */}
        <div
          ref={contentRef}
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
          className="absolute top-0 left-0 min-w-max transition-transform duration-75 ease-out"
        >
          <div className="p-12 min-w-max flex flex-col items-center space-y-12 relative">

            {/* Additional oversight: dashed lines on the zoomable canvas */}
            <OversightLines containerRef={contentRef} mode="canvas" stroke="var(--color-primary-300)" layoutKey={canvasLayoutKey} scale={scale} />

            {/* SVG Master Root-to-Unit Connector Layer */}
            {fullscreenMode === "FULL_ORG" && (
              <SVGMasterUnitConnector
                rootRef={masterRootRef}
                unitRefs={unitCardRefs}
                visibleUnitCodes={visibleUnitCodes}
                containerRef={contentRef}
                onPathsCalculated={setRootToUnitCount}
              />
            )}

            {/* Full Organization Mode */}
            {fullscreenMode === "FULL_ORG" && (
              <>
                {/* Master Hospicio Root */}
                <div ref={masterRootRef} className="flex flex-col items-center relative z-10">
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl px-8 py-4 shadow-2xl border border-primary-500 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Heart className="h-5 w-5 fill-white" />
                      <h2 className="text-lg font-bold font-heading">Hospicio de San Jose</h2>
                    </div>
                    <p className="text-xs text-primary-200 mt-1">Master Organizational Pyramid View</p>
                  </div>
                  <div className="h-8 w-0.5 bg-primary-500" />
                </div>

                {/* Visible Unit Branches in Parallel */}
                <div className="flex justify-center items-start gap-12 min-w-max pt-8">
                  {visibleUnitCodes.map((unitCode) => {
                    const unitNodes = unitGroups.get(unitCode) || [];
                    const meta = UNIT_META[unitCode] || { color: "text-slate-200", bg: "bg-slate-900", border: "border-slate-800", label: unitCode };
                    const unitNodeIds = new Set(unitNodes.map((n) => n.id));

                    const treeRoots = unitNodes.filter((node) => {
                      const supInUnit = node.immediateSupervisorId && unitNodeIds.has(node.immediateSupervisorId);
                      if (supInUnit) return false;
                      const hasChildren = (childrenMap.get(node.id) || []).length > 0;
                      if (unitCode === "FIN" || (!hasChildren && node.supervisorAssignmentStatus === "PENDING" && node.directReportCount === 0 && !node.parentJobRoleId)) {
                        return false;
                      }
                      return true;
                    });

                    const unassignedInUnit = unitNodes.filter((node) => {
                      const supInUnit = node.immediateSupervisorId && unitNodeIds.has(node.immediateSupervisorId);
                      if (supInUnit) return false;
                      const hasChildren = (childrenMap.get(node.id) || []).length > 0;
                      return unitCode === "FIN" || (!hasChildren && node.supervisorAssignmentStatus === "PENDING" && node.directReportCount === 0 && !node.parentJobRoleId);
                    });

                    return (
                      <div
                        key={unitCode}
                        ref={(el) => {
                          if (el) unitCardRefs.current.set(unitCode, el);
                          else unitCardRefs.current.delete(unitCode);
                        }}
                        className="flex flex-col items-center min-w-max"
                      >
                        {/* Unit Container */}
                        <div className={cn("border rounded-2xl p-6 shadow-xl bg-slate-900/90 min-w-max space-y-6", meta.border)}>
                          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                            <Building2 className={cn("h-5 w-5", meta.color)} />
                            <div>
                              <h3 className={cn("text-base font-bold font-heading", meta.color)}>{meta.label}</h3>
                              <p className="text-xs text-muted-foreground">{unitNodes.length} Active Employees</p>
                            </div>
                          </div>

                          {/* Unit Pyramid Trees */}
                          {treeRoots.length > 0 && (
                            <div className="flex justify-center gap-12 items-start min-w-max pt-2">
                              {treeRoots.map((root) => (
                                <OrgChartPyramidBranch
                                  key={root.id}
                                  node={root}
                                  childrenMap={childrenMap}
                                  expandedNodeIds={expandedNodeIds}
                                  onToggleExpand={onToggleNode}
                                  matchingNodeIds={matchingNodeIds}
                                  onOpenAssignSupervisor={onOpenAssignSupervisor}
                                  isFullHR={isFullHR}
                                  visitedPath={new Set()}
                                  navigate={navigate}
                                  unitNodeIds={unitNodeIds}
                                />
                              ))}
                            </div>
                          )}

                          {/* Unassigned Standalone Cards */}
                          {unassignedInUnit.length > 0 && (
                            <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 space-y-3">
                              <div className="flex items-center gap-2 mb-1">
                                <UserX className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold text-slate-300">Unassigned Roles ({unassignedInUnit.length})</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {unassignedInUnit.map((emp) => (
                                  <UnassignedEmployeeCard
                                    key={emp.id}
                                    emp={emp}
                                    isFullHR={isFullHR}
                                    onOpenAssignSupervisor={onOpenAssignSupervisor}
                                    navigate={navigate}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Selected Unit Mode */}
            {fullscreenMode === "UNIT" && (
              <div className="space-y-8 min-w-max">
                {visibleUnitCodes.map((unitCode) => {
                  const unitNodes = unitGroups.get(unitCode) || [];
                  const meta = UNIT_META[unitCode] || { color: "text-slate-200", bg: "bg-slate-900", border: "border-slate-800", label: unitCode };
                  const unitNodeIds = new Set(unitNodes.map((n) => n.id));

                  const treeRoots = unitNodes.filter((node) => {
                    const supInUnit = node.immediateSupervisorId && unitNodeIds.has(node.immediateSupervisorId);
                    if (supInUnit) return false;
                    const hasChildren = (childrenMap.get(node.id) || []).length > 0;
                    if (unitCode === "FIN" || (!hasChildren && node.supervisorAssignmentStatus === "PENDING" && node.directReportCount === 0 && !node.parentJobRoleId)) {
                      return false;
                    }
                    return true;
                  });

                  const unassignedInUnit = unitNodes.filter((node) => {
                    const supInUnit = node.immediateSupervisorId && unitNodeIds.has(node.immediateSupervisorId);
                    if (supInUnit) return false;
                    const hasChildren = (childrenMap.get(node.id) || []).length > 0;
                    return unitCode === "FIN" || (!hasChildren && node.supervisorAssignmentStatus === "PENDING" && node.directReportCount === 0 && !node.parentJobRoleId);
                  });

                  return (
                    <div key={unitCode} className={cn("border rounded-2xl p-8 shadow-2xl bg-slate-900/90 min-w-max space-y-8", meta.border)}>
                      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <Building2 className={cn("h-6 w-6", meta.color)} />
                        <div>
                          <h2 className={cn("text-xl font-bold font-heading", meta.color)}>{meta.label}</h2>
                          <p className="text-xs text-muted-foreground">{unitNodes.length} Active Employees</p>
                        </div>
                      </div>

                      {treeRoots.length > 0 && (
                        <div className="flex justify-center gap-16 items-start min-w-max pt-2">
                          {treeRoots.map((root) => (
                            <OrgChartPyramidBranch
                              key={root.id}
                              node={root}
                              childrenMap={childrenMap}
                              expandedNodeIds={expandedNodeIds}
                              onToggleExpand={onToggleNode}
                              matchingNodeIds={matchingNodeIds}
                              onOpenAssignSupervisor={onOpenAssignSupervisor}
                              isFullHR={isFullHR}
                              visitedPath={new Set()}
                              navigate={navigate}
                              unitNodeIds={unitNodeIds}
                            />
                          ))}
                        </div>
                      )}

                      {unassignedInUnit.length > 0 && (
                        <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <UserX className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-slate-300">Unassigned Roles ({unassignedInUnit.length})</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {unassignedInUnit.map((emp) => (
                              <UnassignedEmployeeCard
                                key={emp.id}
                                emp={emp}
                                isFullHR={isFullHR}
                                onOpenAssignSupervisor={onOpenAssignSupervisor}
                                navigate={navigate}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
    </OversightProvider>
  );
}
