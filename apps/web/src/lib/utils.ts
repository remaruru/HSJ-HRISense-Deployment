import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely — the universal utility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date to a human-readable string */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  return new Intl.DateTimeFormat("en-PH", options).format(
    typeof date === "string" ? new Date(date) : date
  );
}

/** Format date to short form: Jan 15, 2025 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, { year: "numeric", month: "short", day: "numeric" });
}

/** Format date to ISO: 2025-01-15 */
export function formatDateISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/** Format time: 9:00 AM */
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(typeof date === "string" ? new Date(date) : date);
}

/** Relative time: "2 hours ago" */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateShort(d);
}

/** Format PHP currency */
export function formatCurrency(
  amount: number,
  currency = "PHP"
): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Format number with commas: 12,500 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value);
}

/** Format percentage: 94.5% */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Get initials from a full name */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

/**
 * Avatar fill for someone with no photo, picked deterministically from their name.
 *
 * Brand and neutral steps only. It used to pull from the semantic palette —
 * emerald, amber, rose — which meant a person's initials could arrive in the
 * colour that means "expired" or "needs attention" purely because of the letter
 * their name starts with. Those colours are reserved for meaning; an avatar
 * carries identity, so it stays on the brand ramp.
 *
 * All steps are deep enough to keep white initials readable (>= 5:1) in both modes.
 */
export function getAvatarColor(name: string): string {
  const colors = [
    "bg-primary-600",
    "bg-primary-700",
    "bg-slate-600",
    "bg-primary-500",
    "bg-slate-700",
    "bg-primary-800",
    "bg-slate-500",
    "bg-primary-900",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/** Capitalize first letter of each word */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Convert snake_case or UPPER_CASE to Title Case */
export function enumToLabel(value: string): string {
  return toTitleCase(value.replace(/_/g, " ").toLowerCase());
}

/** Sleep utility for development delays */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Check if prefers-reduced-motion is active */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Generate a random ID (for demo data, not production use) */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Get greeting based on time of day */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Color map for status badges */
export const statusColorMap: Record<string, string> = {
  active: "bg-success-light text-success-dark border-success",
  inactive: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning-light text-warning-dark border-warning",
  approved: "bg-success-light text-success-dark border-success",
  rejected: "bg-danger-light text-danger-dark border-danger",
  on_leave: "bg-info-light text-info-dark border-info",
  present: "bg-success-light text-success-dark border-success",
  absent: "bg-danger-light text-danger-dark border-danger",
  late: "bg-warning-light text-warning-dark border-warning",
  compliant: "bg-success-light text-success-dark border-success",
  non_compliant: "bg-danger-light text-danger-dark border-danger",
  at_risk: "bg-warning-light text-warning-dark border-warning",
};

